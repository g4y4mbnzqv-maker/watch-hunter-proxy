export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  // eBay marketplace deletion notification endpoint
  if (req.method === "GET" && req.query.challenge_code) {
    const challengeCode = req.query.challenge_code;
    const verificationToken = process.env.EBAY_VERIFICATION_TOKEN || "watchhunter123456789012345678901";
    const endpoint = `https://watch-hunter-proxy.vercel.app/api/ebay`;
    const hash = require("crypto")
      .createHash("sha256")
      .update(challengeCode + verificationToken + endpoint)
      .digest("hex");
    return res.status(200).json({ challengeResponse: hash });
  }

  // Handle deletion notifications (we just acknowledge them)
  if (req.method === "POST") {
    return res.status(200).json({ acknowledged: true });
  }

  const EBAY_APP_ID  = process.env.EBAY_APP_ID;
  const EBAY_CERT_ID = process.env.EBAY_CERT_ID;
  const EBAY_ENV     = process.env.EBAY_ENV || "SANDBOX";

  const BASE = EBAY_ENV === "SANDBOX"
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";

  try {
    const credentials = Buffer.from(`${EBAY_APP_ID}:${EBAY_CERT_ID}`).toString("base64");
    const tokenRes = await fetch(`${BASE}/identity/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
    });
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;
    if (!token) throw new Error("No token: " + JSON.stringify(tokenData));

    const { query, maxPrice } = req.query;
    const filters = ["buyingOptions:{AUCTION}"];
    if (maxPrice) filters.push(`price:[..${maxPrice}],priceCurrency:GBP`);

    const params = new URLSearchParams({
      q: query || "vintage watch",
      filter: filters.join(","),
      sort: "newlyListed",
      limit: "20",
    });

    const browseRes = await fetch(`${BASE}/buy/browse/v1/item_summary/search?${params}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
        "X-EBAY-C-ENDUSERCTX": "contextualLocation=country%3DGB",
      },
    });
    const browseData = await browseRes.json();
    res.status(200).json(browseData);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
