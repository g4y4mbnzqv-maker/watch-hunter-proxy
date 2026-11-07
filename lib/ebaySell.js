import { randomBytes } from "node:crypto";
import { withSchema } from "./db";
import { CONDITIONS, DEPARTMENTS, MAX_PHOTOS, MAX_PHOTO_BYTES, listingProblem } from "./ebayListing";

export { CONDITIONS, DEPARTMENTS, MAX_PHOTOS, MAX_PHOTO_BYTES, listingProblem };

// Listing your own watches on eBay through its Sell APIs. You sign in to
// eBay once (OAuth), and the app keeps the refresh token in the database to
// act for you: it reads your business policies, uploads your photos, then
// creates and publishes a fixed-price listing.

const AUTH_URL = "https://auth.ebay.com/oauth2/authorize";
const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const API = "https://api.ebay.com";
const MEDIA_URL = "https://apim.ebay.com/commerce/media/v1_beta/image/create_image_from_file";
const SCOPES = [
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account",
];
const MARKETPLACE = "EBAY_GB";
const WATCH_CATEGORY = "31387";
// The address eBay shows as "item location"; only the postcode is needed
export const LOCATION_KEY = "watch-hunter";
export class SellError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

const db = withSchema(async (query) => {
  await query(`CREATE TABLE IF NOT EXISTS ebay_account (name text PRIMARY KEY, value jsonb NOT NULL)`);
});

function config() {
  return {
    clientId: process.env.EBAY_CLIENT_ID,
    clientSecret: process.env.EBAY_CLIENT_SECRET,
    // eBay's name for the redirect address set up in the developer portal
    ruName: process.env.EBAY_RUNAME,
  };
}

// Why listing on eBay can't start yet, or null
export function sellUnavailable() {
  const { clientId, clientSecret, ruName } = config();
  if (!clientId || !clientSecret) return "no-keys";
  if (!ruName) return "no-runame";
  return null;
}

async function readAccount(query) {
  const [row] = await query(`SELECT value FROM ebay_account WHERE name = 'user'`);
  return row?.value ?? null;
}

async function writeAccount(query, value) {
  if (value === null) {
    await query(`DELETE FROM ebay_account WHERE name = 'user'`);
    return;
  }
  await query(
    `INSERT INTO ebay_account (name, value) VALUES ('user', $1::jsonb) ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(value)]
  );
}

export function newState() {
  return randomBytes(16).toString("hex");
}

// Where to send you to sign in to eBay and allow the app to list for you
export function authorizeUrl(state) {
  const { clientId, ruName } = config();
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", ruName);
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

function basicAuth() {
  const { clientId, clientSecret } = config();
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function tokenRequest(body) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new SellError(`eBay sign-in failed: ${data.error_description || data.error || res.status}`, 401);
  return data;
}

// Swaps the code eBay sends back after you sign in for tokens, and saves them
export async function finishSignIn(code, now = Date.now()) {
  const query = await db();
  if (!query) throw new SellError("Listing on eBay needs the database", 503);
  const data = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: config().ruName });
  await writeAccount(query, {
    refreshToken: data.refresh_token,
    refreshExpiresAt: now + (data.refresh_token_expires_in ?? 0) * 1000,
    accessToken: data.access_token,
    expiresAt: now + (data.expires_in ?? 0) * 1000,
    connectedAt: now,
  });
}

export async function disconnect() {
  const query = await db();
  if (query) await writeAccount(query, null);
}

// An access token for your eBay account, refreshed when it's close to
// expiring, or null when you haven't signed in
async function userToken(query, now = Date.now()) {
  const account = await readAccount(query);
  if (!account?.refreshToken) return null;
  if (account.accessToken && account.expiresAt > now + 60_000) return account.accessToken;
  if (account.refreshExpiresAt && account.refreshExpiresAt < now) return null;
  const data = await tokenRequest({ grant_type: "refresh_token", refresh_token: account.refreshToken, scope: SCOPES.join(" ") });
  await writeAccount(query, { ...account, accessToken: data.access_token, expiresAt: now + data.expires_in * 1000 });
  return data.access_token;
}

// eBay's error messages, joined, for showing as they are
function ebayMessage(data, fallback) {
  const errors = data?.errors ?? data?.warnings ?? [];
  const text = errors
    .map((error) => {
      const params = (error.parameters ?? []).map((param) => param.value).filter(Boolean);
      return [error.longMessage || error.message, params.length ? `(${params.join(", ")})` : ""].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join(" ");
  return text || fallback;
}

async function call(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Content-Language": "en-GB",
      "Accept-Language": "en-GB",
      "X-EBAY-C-MARKETPLACE-ID": MARKETPLACE,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  return { ok: res.ok, status: res.status, data };
}

async function requireToken() {
  const query = await db();
  if (!query) throw new SellError("Listing on eBay needs the database", 503);
  const token = await userToken(query);
  if (!token) throw new SellError("Connect your eBay account first", 401);
  return token;
}

// What listing needs from your account: { connected, policies, location }.
// policies holds the first fulfilment, payment and return policy for eBay
// UK ({ id, name } or null each); location is true once the item location
// exists.
export async function sellStatus() {
  const unavailable = sellUnavailable();
  if (unavailable) return { connected: false, unavailable };
  const query = await db();
  if (!query) return { connected: false, unavailable: "no-database" };
  const token = await userToken(query).catch(() => null);
  if (!token) return { connected: false };

  const first = async (kind, list) => {
    const { ok, data } = await call(token, "GET", `/sell/account/v1/${kind}?marketplace_id=${MARKETPLACE}`);
    const policy = ok ? data[list]?.[0] : null;
    return policy ? { id: policy[`${kind.replace(/_policy$/, "")}PolicyId`] ?? policy.policyId, name: policy.name } : null;
  };
  const [fulfillment, payment, returns, location] = await Promise.all([
    first("fulfillment_policy", "fulfillmentPolicies"),
    first("payment_policy", "paymentPolicies"),
    first("return_policy", "returnPolicies"),
    call(token, "GET", `/sell/inventory/v1/location/${LOCATION_KEY}`),
  ]);
  return { connected: true, policies: { fulfillment, payment, returns }, location: location.ok };
}

// Creates the item location from a UK postcode
export async function saveLocation(postcode) {
  const clean = String(postcode ?? "").trim().toUpperCase();
  if (!/^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/.test(clean)) throw new SellError("Enter a UK postcode, such as SW1A 1AA", 400);
  const token = await requireToken();
  const { ok, status, data } = await call(token, "POST", `/sell/inventory/v1/location/${LOCATION_KEY}`, {
    location: { address: { postalCode: clean, country: "GB" } },
    locationTypes: ["WAREHOUSE"],
    name: "Watch Hunter",
    merchantLocationStatus: "ENABLED",
  });
  // 409: it already exists, which is fine
  if (!ok && status !== 409) throw new SellError(ebayMessage(data, `Couldn't save the location (${status})`));
}

// Uploads one of your photos to eBay's picture service; returns its URL
export async function uploadPhoto(bytes, { filename = "watch.jpg", type = "image/jpeg" } = {}) {
  if (!bytes?.length) throw new SellError("That photo is empty", 400);
  if (bytes.length > MAX_PHOTO_BYTES) throw new SellError("That photo is over 12 MB", 400);
  const token = await requireToken();
  const form = new FormData();
  form.append("image", new Blob([bytes], { type }), filename);
  const res = await fetch(MEDIA_URL, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form, cache: "no-store" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new SellError(ebayMessage(data, `Photo upload failed (${res.status})`));
  }
  // eBay returns where the image lives; reading it gives the listing URL
  const location = res.headers.get("location");
  if (!location) throw new SellError("eBay didn't say where the photo went");
  const image = await fetch(location, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const data = await image.json().catch(() => ({}));
  if (!image.ok || !data.imageUrl) throw new SellError(ebayMessage(data, "Couldn't read the uploaded photo"));
  return data.imageUrl;
}

// Creates or updates the eBay inventory item and an unpublished offer for
// it. Returns { sku, offerId }. Nothing shows on eBay until publish().
export async function prepareListing(input) {
  const problem = listingProblem(input);
  if (problem) throw new SellError(problem, 400);
  const token = await requireToken();
  const status = await sellStatus();
  const { fulfillment, payment, returns } = status.policies ?? {};
  if (!fulfillment || !payment || !returns) {
    throw new SellError("Your eBay account needs postage, payment and returns policies first (eBay: Account, Business policies)", 400);
  }
  if (!status.location) throw new SellError("Add your postcode first", 400);

  const sku = `wh-${String(input.dealId).replace(/[^A-Za-z0-9-]/g, "").slice(0, 40)}`;
  const aspects = { Brand: [input.brand.trim()], Department: [input.department], Type: ["Wristwatch"] };
  if (input.model?.trim()) aspects.Model = [input.model.trim()];
  if (input.reference?.trim()) aspects["Reference Number"] = [input.reference.trim()];

  const item = await call(token, "PUT", `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
    availability: { shipToLocationAvailability: { quantity: 1 } },
    condition: input.condition,
    product: { title: input.title.trim(), description: input.description.trim(), aspects, imageUrls: input.photos },
  });
  if (!item.ok) throw new SellError(ebayMessage(item.data, `Couldn't save the watch on eBay (${item.status})`));

  const offer = {
    sku,
    marketplaceId: MARKETPLACE,
    format: "FIXED_PRICE",
    availableQuantity: 1,
    categoryId: WATCH_CATEGORY,
    listingDescription: input.description.trim(),
    merchantLocationKey: LOCATION_KEY,
    pricingSummary: { price: { value: Number(input.price).toFixed(2), currency: "GBP" } },
    listingPolicies: {
      fulfillmentPolicyId: fulfillment.id,
      paymentPolicyId: payment.id,
      returnPolicyId: returns.id,
      ...(input.bestOffer
        ? {
            bestOfferTerms: {
              bestOfferEnabled: true,
              ...(Number(input.minOffer) > 0 ? { autoDeclinePrice: { value: Number(input.minOffer).toFixed(2), currency: "GBP" } } : {}),
            },
          }
        : {}),
    },
  };

  // An earlier try may have left an offer for this watch: update it
  const existing = await call(token, "GET", `/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}&marketplace_id=${MARKETPLACE}`);
  const offerId = existing.ok ? existing.data.offers?.[0]?.offerId : null;
  if (offerId) {
    const updated = await call(token, "PUT", `/sell/inventory/v1/offer/${offerId}`, offer);
    if (!updated.ok) throw new SellError(ebayMessage(updated.data, `Couldn't update the listing (${updated.status})`));
    return { sku, offerId };
  }
  const created = await call(token, "POST", "/sell/inventory/v1/offer", offer);
  if (!created.ok) throw new SellError(ebayMessage(created.data, `Couldn't create the listing (${created.status})`));
  return { sku, offerId: created.data.offerId };
}

// Puts a prepared listing live on eBay. Returns { listingId, url }.
export async function publish(offerId) {
  if (!/^\d+$/.test(String(offerId ?? ""))) throw new SellError("That listing isn't ready", 400);
  const token = await requireToken();
  const { ok, status, data } = await call(token, "POST", `/sell/inventory/v1/offer/${offerId}/publish`, {});
  if (!ok) throw new SellError(ebayMessage(data, `eBay didn't publish the listing (${status})`));
  return { listingId: data.listingId, url: `https://www.ebay.co.uk/itm/${data.listingId}` };
}
