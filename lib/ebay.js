let cachedToken = null;
let tokenExpiry = null;

async function getToken() {
  if (cachedToken && tokenExpiry > Date.now()) {
    return cachedToken;
  }

  const credentials = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const body = new URLSearchParams();
  body.append("grant_type", "client_credentials");
  body.append(
    "scope",
    "https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/buy.browse"
  );

  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Token error: " + err);
  }

  const data = await res.json();

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

  return cachedToken;
}

async function ebayFetch(url) {
  const token = await getToken();

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("eBay error: " + err);
  }

  return res.json();
}

export async function search(params) {
  const url = new URL(
    "https://api.ebay.com/buy/browse/v1/item_summary/search"
  );

  Object.entries(params).forEach(([k, v]) =>
    url.searchParams.set(k, v)
  );

  return ebayFetch(url.toString());
}