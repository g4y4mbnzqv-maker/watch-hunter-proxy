import { extractModelRef, sameModel, baseModel } from "./models";
import { misspelling, typoQuery } from "./overlooked";
import { extractModelName } from "./nicknames";
import { caseDetails, detailsMatch } from "./caseDetails";
import { COMPS_STORE_MS, readComps, saveComps } from "./compsStore";

const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const ITEM_URL = "https://api.ebay.com/buy/browse/v1/item/";
const RATE_LIMIT_URL = "https://api.ebay.com/developer/analytics/v1_beta/rate_limit/";
const TAXONOMY_URL = "https://api.ebay.com/commerce/taxonomy/v1/";
const SCOPE = "https://api.ebay.com/oauth/api_scope";

// Titles matching any of these are parts, accessories or non-working watches
const JUNK_PATTERNS = [
  /\bfor parts\b/i,
  /\bparts only\b/i,
  /\bspares\b/i,
  /\brepairs?\b/i,
  /\bnot working\b/i,
  /\bnon[- ]?working\b/i,
  /\bbox only\b/i,
  /\bempty box\b/i,
  /\bstrap only\b/i,
  /\bwatch strap\b/i,
  /\breplacement strap\b/i,
  /\bbracelet only\b/i,
  /\bdial only\b/i,
  /\bmovement only\b/i,
  /\bcase only\b/i,
  /\bcrystal only\b/i,
  /\bbezel insert\b/i,
  /\bmanual only\b/i,
];

// Titles matching any of these are fakes or lookalikes of another brand's
// watch. They are always dropped, from auctions and from resale prices.
const REPLICA_PATTERNS = [
  /\bhomage\b/i,
  /\breplica\b/i,
  /\bfake\b/i,
  /\bcopy\b(?! of)/i,
  /\bclone\b/i,
  /\bnot genuine\b/i,
  /\bunbranded\b/i,
  /\b1:1\b/,
  /\bAAA\b/,
  // "Rolex style", "Submariner-inspired" and similar
  /\b(rolex|omega|cartier|patek|audemars|submariner|daytona|datejust|gmt|seamaster|speedmaster|nautilus|royal oak)[- ](style|inspired)\b/i,
];

// Usage figures are reused for this long, so the counter adds few calls
const USAGE_CACHE_MS = 30_000;
// eBay's category for wristwatches rarely changes, so look it up daily, and
// retry sooner if the lookup failed
const CATEGORY_CACHE_MS = 24 * 60 * 60_000;
const CATEGORY_RETRY_MS = 10 * 60_000;

// Repeat scans of the same brand within this window reuse the last response
const SEARCH_CACHE_MS = 60_000;
// Asking prices move slowly, so comparables are kept for longer
const COMPS_CACHE_MS = COMPS_STORE_MS;
// Fewer listings than this is too thin to estimate a price from
const MIN_COMPS = 3;
// Asking prices more than this many times above or below the median are
// ignored, so a few silly or special listings can't skew the estimate
const OUTLIER_FACTOR = 2.5;
// Photos kept per listing for the gallery
const MAX_IMAGES = 12;
// eBay's buying option for each listing type the app shows
const LISTING_TYPES = {
  AUCTION: { filter: "AUCTION", sort: "endingSoonest" },
  // Newest first, since an underpriced listing rarely lasts
  BUY_IT_NOW: { filter: "FIXED_PRICE", sort: "newlyListed" },
};
// Parallel comparables lookups per scan
const COMPS_CONCURRENCY = 6;
// Parallel item lookups when refreshing the watchlist
const ITEM_CONCURRENCY = 5;

let cachedToken = null;
// Requests already under way, so parallel callers share one eBay call
let tokenInFlight = null;
let categoryInFlight = null;
const compsInFlight = new Map();
let cachedUsage = null;
let cachedCategory = null;
const searchCache = new Map();
const compsCache = new Map();

async function getAccessToken() {
  // Refresh a minute early so a token never expires mid-request
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  tokenInFlight ??= requestAccessToken().finally(() => {
    tokenInFlight = null;
  });
  return tokenInFlight;
}

async function requestAccessToken() {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new EbayError(
      "EBAY_CLIENT_ID and EBAY_CLIENT_SECRET must be set",
      500
    );
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: SCOPE,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw await ebayFailure(res, "token request");
  }

  const data = await res.json();

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.value;
}

const BROWSE_HEADERS = {
  "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
  "X-EBAY-C-ENDUSERCTX": "contextualLocation=country%3DGB",
};

async function browseSearch(params) {
  return (await browsePage(params)).items;
}

async function browsePage(params) {
  const token = await getAccessToken();

  const url = new URL(SEARCH_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  // Every search is for watches, so keep out cars, parts and anything else
  // that shares a brand name, such as a Vauxhall Omega
  const categoryId = await getWatchCategoryId();
  if (categoryId) url.searchParams.set("category_ids", categoryId);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, ...BROWSE_HEADERS },
    cache: "no-store",
  });

  if (!res.ok) {
    throw await ebayFailure(res, "search");
  }

  const data = await res.json();
  // total is how many listings match in all, beyond the page returned
  return { items: data.itemSummaries || [], total: data.total ?? 0 };
}

// Finds eBay UK's Wristwatches category through the Taxonomy API, so the ID
// is never guessed. Returns the category ID, or null if eBay doesn't answer,
// in which case searches run without it and isWatchListing still filters.
export async function getWatchCategoryId() {
  if (cachedCategory && cachedCategory.expiresAt > Date.now()) return cachedCategory.id;
  categoryInFlight ??= lookUpWatchCategory().finally(() => {
    categoryInFlight = null;
  });
  return categoryInFlight;
}

async function lookUpWatchCategory() {
  let id = null;
  try {
    const token = await getAccessToken();
    const headers = { Authorization: `Bearer ${token}` };

    const treeRes = await fetch(
      `${TAXONOMY_URL}get_default_category_tree_id?marketplace_id=EBAY_GB`,
      { headers, cache: "no-store" }
    );
    if (!treeRes.ok) throw new Error(`category tree lookup failed (${treeRes.status})`);
    const { categoryTreeId } = await treeRes.json();

    const suggestRes = await fetch(
      `${TAXONOMY_URL}category_tree/${categoryTreeId}/get_category_suggestions?q=wristwatch`,
      { headers, cache: "no-store" }
    );
    if (!suggestRes.ok) throw new Error(`category suggestions failed (${suggestRes.status})`);
    const { categorySuggestions = [] } = await suggestRes.json();

    const match = categorySuggestions.find((suggestion) =>
      /^wrist ?watches$/i.test(suggestion.category?.categoryName ?? "")
    );
    id = match?.category?.categoryId ?? null;
  } catch (err) {
    console.error("Couldn't find eBay's wristwatch category:", err.message);
  }

  cachedCategory = { id, expiresAt: Date.now() + (id ? CATEGORY_CACHE_MS : CATEGORY_RETRY_MS) };
  return id;
}

// Backup to the category filter: drops listings eBay files under no watch
// category at all. Listings without category details are kept.
export function isWatchListing(item) {
  const names = (item.categories || []).map((category) => category.categoryName || "");
  return !names.length || names.some((name) => /watch/i.test(name));
}

// Searches one brand for auctions, Buy It Now listings or both. Returns
// { items, stats }, where stats explains what happened to eBay's results so
// an empty scan can say why: { auctionsOnEbay, buyItNowOnEbay, checked,
// notWatches, outsideUk, replicas, junk, shown }. auctionsOnEbay is null
// when auctions weren't searched. buyItNowOnEbay comes from the Buy It Now
// search when there is one, or from a one-result count when nothing else is
// left to show, and is null otherwise.
export async function searchListings(brand, { includeJunk = false, types = ["AUCTION"] } = {}) {
  const query = brand.toLowerCase();
  const typos = typoQuery(query);
  const [fetched, misspelt] = await Promise.all([
    Promise.all(types.map((type) => fetchListings(query, type))),
    // One more search per listing type for common misspellings of the brand,
    // which fewer buyers find. A failure here shouldn't sink the scan.
    typos
      ? Promise.all(types.map((type) => fetchListings(typos, type))).catch((err) => {
          console.error("Misspelling search failed", err);
          return [];
        })
      : [],
  ]);
  const byType = Object.fromEntries(types.map((type, index) => [type, fetched[index]]));
  const typoItems = misspelt
    .flatMap((result) => result.items)
    .map((item) => ({ ...item, misspelt: misspelling(item.title, query) }))
    .filter((item) => item.misspelt);

  // A listing offering both bidding and Buy It Now can come back twice
  const seen = new Set();
  const items = [...fetched.flatMap((result) => result.items), ...typoItems]
    .filter((item) => !seen.has(item.itemId) && seen.add(item.itemId))
    // Recompute time left so cached results stay accurate
    .map((item) => ({ ...item, hoursLeft: hoursUntil(item.endTime) }));

  const genuine = items.filter((item) => !isReplica(item.title));
  const shown = includeJunk ? genuine : genuine.filter((item) => !isJunk(item.title));
  const sum = (field) => fetched.reduce((total, result) => total + result[field], 0);

  return {
    items: shown,
    stats: {
      auctionsOnEbay: byType.AUCTION ? byType.AUCTION.total : null,
      buyItNowOnEbay: byType.BUY_IT_NOW
        ? byType.BUY_IT_NOW.total
        : shown.length
        ? null
        : await countBuyItNow(query),
      checked: sum("checked"),
      notWatches: sum("notWatches"),
      outsideUk: sum("outsideUk"),
      replicas: items.length - genuine.length,
      junk: genuine.length - shown.length,
      shown: shown.length,
      misspelt: shown.filter((item) => item.misspelt).length,
    },
  };
}

async function fetchListings(brand, type) {
  const key = `${type}|${brand}`;
  const cached = searchCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const { filter, sort } = LISTING_TYPES[type];
  const page = await browsePage({
    q: brand,
    filter: `buyingOptions:{${filter}},itemLocationCountry:GB`,
    sort,
    limit: "50",
  });

  const watches = page.items.filter(isWatchListing);
  const inUk = watches.filter(isInUk);
  const result = {
    items: inUk.map(toListing),
    total: page.total,
    checked: page.items.length,
    notWatches: page.items.length - watches.length,
    outsideUk: watches.length - inUk.length,
  };

  searchCache.set(key, { result, expiresAt: Date.now() + SEARCH_CACHE_MS });

  return result;
}

// How many UK Buy It Now listings match, from a one-result search
async function countBuyItNow(brand) {
  const key = `count|${brand}`;
  const cached = searchCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const result = await browsePage({
    q: brand,
    filter: "buyingOptions:{FIXED_PRICE},itemLocationCountry:GB",
    limit: "1",
  })
    .then((page) => page.total)
    // The count only explains an empty scan, so a failure shouldn't stop it
    .catch(() => null);

  searchCache.set(key, { result, expiresAt: Date.now() + SEARCH_CACHE_MS });

  return result;
}

// What to compare a listing against: its reference number where it has one,
// otherwise a known model name such as "Seiko Turtle". Returns
// { key, query, matches(title) }, or null when there is neither.
function comparisonModel(item, brand) {
  if (item.modelRef) {
    // SRPD55K1 and SRPD55J1 share one lookup
    const base = baseModel(item.modelRef);
    return {
      key: `ref:${base}`,
      query: `${brand} ${base}`,
      matches: (title) => sameModel(baseModel(extractModelRef(title) ?? ""), base),
    };
  }
  if (item.modelName) {
    return {
      key: `name:${item.modelName}`,
      query: item.modelName,
      // A listing with its own reference is a specific watch, so only
      // compare against others known by the same name alone
      matches: (title) => !extractModelRef(title) && extractModelName(title) === item.modelName,
    };
  }
  return null;
}

// Looks up current Buy It Now prices for each listing's model, in the same
// condition where possible. Returns { [itemId]: stats }, where stats is
// { median, low, high, count, ignored, condition, matchedBy } or null when
// too few listings match. condition is "NEW", "USED", or null when the
// estimate had to mix conditions; matchedBy is "reference" or "name".
// onLimit is called if any lookup hit eBay's call allowance; those listings
// are left without an estimate.
export async function getComparables(brand, items, { onLimit } = {}) {
  const lookups = new Map();
  const keyFor = new Map();
  for (const item of items) {
    const model = comparisonModel(item, brand);
    if (!model) continue;
    const details = caseDetails(item.title);
    const key = `${model.key}|${item.conditionGroup ?? ""}|${details.size ?? ""}|${details.precious ? "precious" : ""}`;
    keyFor.set(item.itemId, key);
    lookups.set(key, { model, condition: item.conditionGroup, details });
  }

  const entries = [...lookups.entries()];
  const stats = await mapPool(entries, COMPS_CONCURRENCY, ([, { model, condition, details }]) =>
    comparablesFor(brand, model, condition, details).catch((err) => {
      if (err.limitReached) onLimit?.();
      return null;
    })
  );
  const byKey = Object.fromEntries(entries.map(([key], index) => [key, stats[index]]));

  return Object.fromEntries([...keyFor].map(([itemId, key]) => [itemId, byKey[key]]));
}

// Tries the closest match first, then looser ones when there are too few
// listings to judge: same case size and metal in the same condition, the
// model alone in the same condition, then both again in any condition. The
// any-condition search only runs when the same-condition one falls short,
// so this costs no more eBay calls than matching the model alone.
async function comparablesFor(brand, model, condition, details) {
  const detailed = { ...model, matches: (title) => model.matches(title) && detailsMatch(details, title) };
  for (const cond of condition ? [condition, null] : [null]) {
    const listings = await fetchComparables(brand, model, cond);
    const close = summarise(listings, detailed, cond);
    if (close) {
      const matched = describeDetails(details);
      return matched ? { ...close, details: matched } : close;
    }
    const loose = summarise(listings, model, cond);
    if (loose) return loose;
  }
  return null;
}

// "40mm" or "solid gold, 38mm" for the card, or null when nothing beyond
// the model was matched
function describeDetails(details) {
  const parts = [details.precious && "solid gold or platinum", details.size && `${details.size}mm`].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

// The current Buy It Now listings for a model, as { title, price }, fetched
// once per model and condition and cached
async function fetchComparables(brand, model, condition) {
  const key = `${brand.toLowerCase()}|${model.key}|${condition ?? "ANY"}`;
  const cached = compsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.listings;

  if (!compsInFlight.has(key)) {
    compsInFlight.set(
      key,
      lookUpComparables(key, model, condition).finally(() => compsInFlight.delete(key))
    );
  }
  return compsInFlight.get(key);
}

async function lookUpComparables(key, model, condition) {
  // Another server instance, an alert check or the daily run may already
  // have looked this model up
  const saved = await readComps(key);
  if (saved) {
    compsCache.set(key, { listings: saved.listings, expiresAt: saved.fetchedAt + COMPS_CACHE_MS });
    return saved.listings;
  }

  const filters = [
    "buyingOptions:{FIXED_PRICE}",
    "priceCurrency:GBP",
    "itemLocationCountry:GB",
  ];
  if (condition) filters.push(`conditions:{${condition}}`);

  const summaries = await browseSearch({
    q: model.query,
    filter: filters.join(","),
    limit: "50",
  });

  const listings = summaries
    .filter(isInUk)
    .filter(isWatchListing)
    .filter((item) => !isJunk(item.title) && !isReplica(item.title))
    .map((item) => ({ title: item.title, price: parseFloat(item.price?.value) }))
    .filter((item) => item.price > 0);

  compsCache.set(key, { listings, expiresAt: Date.now() + COMPS_CACHE_MS });
  await saveComps(key, listings);

  return listings;
}

// Price stats from the listings that really are the same model, or null
// when too few match
function summarise(listings, model, condition) {
  const prices = listings
    .filter((item) => model.matches(item.title))
    .map((item) => item.price)
    .sort((a, b) => a - b);

  const kept = withoutOutliers(prices);
  if (kept.length < MIN_COMPS) return null;

  return {
    median: median(kept),
    low: kept[0],
    high: kept[kept.length - 1],
    count: kept.length,
    ignored: prices.length - kept.length,
    condition,
    matchedBy: model.key.startsWith("ref:") ? "reference" : "name",
  };
}

// Fetches the latest state of saved auctions. Returns { items, missing },
// where missing lists IDs eBay no longer returns (usually ended listings).
export async function getAuctions(itemIds) {
  const items = [];
  const missing = [];

  const fetched = await mapPool(itemIds, ITEM_CONCURRENCY, fetchItem);

  itemIds.forEach((itemId, index) => {
    if (fetched[index]) {
      const item = toListing(fetched[index]);
      items.push({ ...item, hoursLeft: hoursUntil(item.endTime) });
    } else {
      missing.push(itemId);
    }
  });

  return { items, missing };
}

async function fetchItem(itemId) {
  const token = await getAccessToken();

  const res = await fetch(ITEM_URL + encodeURIComponent(itemId), {
    headers: { Authorization: `Bearer ${token}`, ...BROWSE_HEADERS },
    cache: "no-store",
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    throw await ebayFailure(res, "item lookup");
  }

  return res.json();
}

// The search already filters to UK listings; this catches any that slip
// through. Listings without a stated location are kept.
function isInUk(item) {
  const country = item.itemLocation?.country;
  return !country || country === "GB";
}

// Reads this app's Browse API allowance from eBay's Developer Analytics
// API. Returns { limit, remaining, used, reset } for the tightest Browse
// limit, or null when eBay doesn't report one.
export async function getUsage() {
  if (cachedUsage && cachedUsage.expiresAt > Date.now()) return cachedUsage.usage;

  const token = await getAccessToken();
  const url = new URL(RATE_LIMIT_URL);
  url.searchParams.set("api_context", "buy");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new EbayError(
      `eBay usage lookup failed (${res.status}): ${await res.text()}`,
      502
    );
  }

  const data = await res.json();
  const rates = (data.rateLimits || [])
    .filter((api) => /browse/i.test(api.apiName || ""))
    .flatMap((api) => api.resources || [])
    .flatMap((resource) => resource.rates || [])
    .filter((rate) => Number.isFinite(rate.limit) && Number.isFinite(rate.remaining));

  // The rate with the least room left is the one that stops scans first
  const tightest = rates.sort(
    (a, b) => a.remaining / a.limit - b.remaining / b.limit
  )[0];

  const usage = tightest
    ? {
        limit: tightest.limit,
        remaining: tightest.remaining,
        used: tightest.limit - tightest.remaining,
        reset: tightest.reset ?? null,
      }
    : null;

  cachedUsage = { usage, expiresAt: Date.now() + USAGE_CACHE_MS };
  return usage;
}

export function isReplica(title) {
  return REPLICA_PATTERNS.some((pattern) => pattern.test(title));
}

export function isJunk(title) {
  return JUNK_PATTERNS.some((pattern) => pattern.test(title));
}

function toListing(item) {
  const options = item.buyingOptions || [];
  // Listings that offer both count as auctions, since the bid decides
  const isAuction = options.includes("AUCTION") || item.currentBidPrice !== undefined;
  const currentBid = parseFloat(
    (isAuction ? item.currentBidPrice?.value : undefined) ?? item.price?.value ?? 0
  );
  const modelRef = extractModelRef(item.title);
  const postage = getPostage(item.shippingOptions);

  return {
    itemId: item.itemId,
    title: item.title,
    url: item.itemWebUrl,
    image: item.image?.imageUrl,
    // The main photo first, then any others, for the gallery
    images: [item.image, ...(item.additionalImages || [])]
      .map((image) => image?.imageUrl)
      .filter(Boolean)
      .slice(0, MAX_IMAGES),
    listingType: isAuction ? "AUCTION" : "BUY_IT_NOW",
    bestOffer: options.includes("BEST_OFFER"),
    condition: item.condition,
    conditionId: item.conditionId ?? null,
    conditionGroup: conditionGroup(item.conditionId),
    modelRef,
    modelName: modelRef ? null : extractModelName(item.title),
    currentBid,
    postage,
    // Postage unknown (collection only or calculated) counts as zero
    totalCost: Math.round((currentBid + (postage ?? 0)) * 100) / 100,
    bidCount: item.bidCount || 0,
    // Buy It Now listings can run until sold, so may have no end time
    endTime: isAuction ? item.itemEndDate : null,
    seller: toSeller(item.seller),
    // eBay checks these with its own experts before they reach the buyer
    authenticityGuarantee: (item.qualifiedPrograms || []).includes("AUTHENTICITY_GUARANTEE"),
  };
}

function toSeller(seller) {
  if (!seller) return null;

  const percentage = parseFloat(seller.feedbackPercentage);

  return {
    username: seller.username ?? null,
    feedbackScore: Number.isFinite(seller.feedbackScore) ? seller.feedbackScore : null,
    feedbackPercentage: Number.isFinite(percentage) ? percentage : null,
  };
}

// eBay condition IDs 1000 to 1999 are new; 2000 and above are refurbished
// or used. Returns "NEW", "USED", or null when eBay doesn't say.
function conditionGroup(conditionId) {
  const id = parseInt(conditionId, 10);
  if (!Number.isFinite(id)) return null;
  return id < 2000 ? "NEW" : "USED";
}

// Runs fn over items with at most limit calls in flight at once, starting
// the next as soon as one finishes. Results keep the order of items.
export async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function hoursUntil(endTime) {
  if (!endTime) return 0;
  return Math.max(new Date(endTime).getTime() - Date.now(), 0) / 3_600_000;
}

function getPostage(shippingOptions) {
  if (!shippingOptions?.length) return null;

  const costs = shippingOptions
    .map((option) => option.shippingCost?.value)
    .filter((value) => value !== undefined)
    .map(parseFloat);

  if (!costs.length) return null;

  return Math.min(...costs);
}

// Drops prices far from the median of a sorted list
export function withoutOutliers(sorted) {
  if (sorted.length < MIN_COMPS) return sorted;
  const middle = median(sorted);
  return sorted.filter(
    (price) => price <= middle * OUTLIER_FACTOR && price >= middle / OUTLIER_FACTOR
  );
}

function median(sorted) {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export class EbayError extends Error {
  constructor(message, status, { limitReached = false } = {}) {
    super(message);
    this.status = status;
    // True when eBay refused the call because the daily allowance is used up
    this.limitReached = limitReached;
  }
}

// Turns a failed eBay response into an EbayError. eBay answers 429 once the
// app has used its call allowance, which gets a plain-English message.
async function ebayFailure(res, what) {
  if (res.status === 429) {
    return new EbayError(
      "You've used this app's eBay call allowance for now. Scans will work again once it resets.",
      429,
      { limitReached: true }
    );
  }
  return new EbayError(`eBay ${what} failed (${res.status}): ${await res.text()}`, 502);
}
