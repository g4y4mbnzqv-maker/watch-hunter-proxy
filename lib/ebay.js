let cachedToken = null;
let tokenExpiry = null;

export async function getToken() {
  if (cachedToken && tokenExpiry > Date.now()) return cachedToken;

  const creds = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
  });

  const data = await res.json();

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

  return cachedToken;
}

async function ebayFetch(url) {
  const token = await getToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

export async function search(params) {
  const url = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return ebayFetch(url.toString());
}

export async function getItems(itemIds) {
  const url = new URL("https://api.ebay.com/buy/browse/v1/item/");
  // eBay expects comma-separated item_ids
  url.searchParams.set("item_ids", itemIds.join(","));
  return ebayFetch(url.toString());
}