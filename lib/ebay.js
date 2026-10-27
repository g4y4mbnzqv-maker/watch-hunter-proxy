const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
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

// Repeat scans of the same brand within this window reuse the last response
const SEARCH_CACHE_MS = 60_000;

let cachedToken = null;
const searchCache = new Map();

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

export async function searchAuctions(brand, { includeJunk = false } = {}) {
  const raw = await fetchAuctions(brand.toLowerCase());
  // Recompute time left so cached results stay accurate
  const items = raw.map((item) => ({ ...item, hoursLeft: hoursUntil(item.endTime) }));

  if (includeJunk) return items;

  return items.filter((item) => !isJunk(item.title));
}

async function fetchAuctions(brand) {
  const cached = searchCache.get(brand);
  if (cached && cached.expiresAt > Date.now()) return cached.items;

  const token = await getAccessToken();

  const url = new URL(SEARCH_URL);
  url.searchParams.set("q", brand);
  url.searchParams.set("filter", "buyingOptions:{AUCTION}");
  url.searchParams.set("sort", "endingSoonest");
  url.searchParams.set("limit", "50");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
      "X-EBAY-C-ENDUSERCTX": "contextualLocation=country%3DGB",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new EbayError(
      `eBay search failed (${res.status}): ${await res.text()}`,
      502
    );
  }

  const data = await res.json();
  const items = (data.itemSummaries || []).map(toAuction);

  searchCache.set(brand, { items, expiresAt: Date.now() + SEARCH_CACHE_MS });

  return items;
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
    currentBid,
    postage,
    // Postage unknown (collection only or calculated) counts as zero
    totalCost: Math.round((currentBid + (postage ?? 0)) * 100) / 100,
    bidCount: item.bidCount || 0,
    endTime: item.itemEndDate,
  };
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

export class EbayError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
