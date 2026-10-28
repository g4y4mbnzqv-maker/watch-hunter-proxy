import { extractModelRef, sameModel, baseModel } from "./models";

const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const ITEM_URL = "https://api.ebay.com/buy/browse/v1/item/";
const RATE_LIMIT_URL = "https://api.ebay.com/developer/analytics/v1_beta/rate_limit/";
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

// Repeat scans of the same brand within this window reuse the last response
const SEARCH_CACHE_MS = 60_000;
// Asking prices move slowly, so comparables are kept for longer
const COMPS_CACHE_MS = 60 * 60_000;
// Fewer listings than this is too thin to estimate a price from
const MIN_COMPS = 3;
// Parallel comparables lookups per scan
const COMPS_CONCURRENCY = 5;
// Parallel item lookups when refreshing the watchlist
const ITEM_CONCURRENCY = 5;

let cachedToken = null;
let cachedUsage = null;
const searchCache = new Map();
const compsCache = new Map();

async function getAccessToken() {
  // Refresh a minute early so a token never expires mid-request
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

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
    throw new EbayError(
      `eBay token request failed (${res.status}): ${await res.text()}`,
      502
    );
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
  const token = await getAccessToken();

  const url = new URL(SEARCH_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, ...BROWSE_HEADERS },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new EbayError(
      `eBay search failed (${res.status}): ${await res.text()}`,
      502
    );
  }

  const data = await res.json();
  return data.itemSummaries || [];
}

export async function searchAuctions(brand, { includeJunk = false } = {}) {
  const raw = await fetchAuctions(brand.toLowerCase());
  // Recompute time left so cached results stay accurate
  const items = raw.map((item) => ({ ...item, hoursLeft: hoursUntil(item.endTime) }));

  const genuine = items.filter((item) => !isReplica(item.title));

  if (includeJunk) return genuine;

  return genuine.filter((item) => !isJunk(item.title));
}

async function fetchAuctions(brand) {
  const cached = searchCache.get(brand);
  if (cached && cached.expiresAt > Date.now()) return cached.items;

  const summaries = await browseSearch({
    q: brand,
    filter: "buyingOptions:{AUCTION},itemLocationCountry:GB",
    sort: "endingSoonest",
    limit: "50",
  });

  const items = summaries.filter(isInUk).map(toAuction);

  searchCache.set(brand, { items, expiresAt: Date.now() + SEARCH_CACHE_MS });

  return items;
}

// Looks up current Buy It Now prices for each model reference found in the
// auctions. Returns { [ref]: { median, low, high, count } }, or null for a
// reference with too few listings to judge.
// Looks up current Buy It Now prices for each auction's model reference,
// in the same condition where possible. Returns { [itemId]: stats }, where
// stats is { median, low, high, count, condition } or null when too few
// listings match. condition is "NEW", "USED", or null when the estimate had
// to mix conditions.
export async function getComparables(brand, items) {
  // SRPD55K1 and SRPD55J1 share one lookup
  const lookups = new Map();
  for (const item of items) {
    if (!item.modelRef) continue;
    const base = baseModel(item.modelRef);
    const key = `${base}|${item.conditionGroup ?? ""}`;
    lookups.set(key, { base, condition: item.conditionGroup });
  }

  const entries = [...lookups.entries()];
  const byKey = {};

  for (let i = 0; i < entries.length; i += COMPS_CONCURRENCY) {
    const batch = entries.slice(i, i + COMPS_CONCURRENCY);
    const stats = await Promise.all(
      batch.map(([, { base, condition }]) =>
        comparablesFor(brand, base, condition).catch(() => null)
      )
    );
    batch.forEach(([key], index) => {
      byKey[key] = stats[index];
    });
  }

  return Object.fromEntries(
    items
      .filter((item) => item.modelRef)
      .map((item) => [
        item.itemId,
        byKey[`${baseModel(item.modelRef)}|${item.conditionGroup ?? ""}`],
      ])
  );
}

// Tries listings in the same condition first, then falls back to any
// condition when there are too few to judge
async function comparablesFor(brand, base, condition) {
  if (condition) {
    const matched = await fetchComparables(brand, base, condition);
    if (matched) return matched;
  }
  return fetchComparables(brand, base, null);
}

async function fetchComparables(brand, base, condition) {
  const key = `${brand.toLowerCase()}|${base}|${condition ?? "ANY"}`;
  const cached = compsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.stats;

  const filters = [
    "buyingOptions:{FIXED_PRICE}",
    "priceCurrency:GBP",
    "itemLocationCountry:GB",
  ];
  if (condition) filters.push(`conditions:{${condition}}`);

  const summaries = await browseSearch({
    q: `${brand} ${base}`,
    filter: filters.join(","),
    limit: "50",
  });

  const prices = summaries
    .filter(isInUk)
    .filter((item) => !isJunk(item.title) && !isReplica(item.title))
    // Only count listings that really are the same reference
    .filter((item) => sameModel(baseModel(extractModelRef(item.title) ?? ""), base))
    .map((item) => parseFloat(item.price?.value))
    .filter((price) => price > 0)
    .sort((a, b) => a - b);

  const stats =
    prices.length >= MIN_COMPS
      ? {
          median: median(prices),
          low: prices[0],
          high: prices[prices.length - 1],
          count: prices.length,
          condition,
        }
      : null;

  compsCache.set(key, { stats, expiresAt: Date.now() + COMPS_CACHE_MS });

  return stats;
}

// Fetches the latest state of saved auctions. Returns { items, missing },
// where missing lists IDs eBay no longer returns (usually ended listings).
export async function getAuctions(itemIds) {
  const items = [];
  const missing = [];

  for (let i = 0; i < itemIds.length; i += ITEM_CONCURRENCY) {
    const batch = itemIds.slice(i, i + ITEM_CONCURRENCY);
    const fetched = await Promise.all(batch.map(fetchItem));

    batch.forEach((itemId, index) => {
      if (fetched[index]) {
        const item = toAuction(fetched[index]);
        items.push({ ...item, hoursLeft: hoursUntil(item.endTime) });
      } else {
        missing.push(itemId);
      }
    });
  }

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
    throw new EbayError(
      `eBay item lookup failed (${res.status}): ${await res.text()}`,
      502
    );
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

function toAuction(item) {
  const currentBid = parseFloat(
    item.currentBidPrice?.value ?? item.price?.value ?? 0
  );
  const postage = getPostage(item.shippingOptions);

  return {
    itemId: item.itemId,
    title: item.title,
    url: item.itemWebUrl,
    image: item.image?.imageUrl,
    condition: item.condition,
    conditionGroup: conditionGroup(item.conditionId),
    modelRef: extractModelRef(item.title),
    currentBid,
    postage,
    // Postage unknown (collection only or calculated) counts as zero
    totalCost: Math.round((currentBid + (postage ?? 0)) * 100) / 100,
    bidCount: item.bidCount || 0,
    endTime: item.itemEndDate,
    seller: toSeller(item.seller),
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

function median(sorted) {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export class EbayError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
