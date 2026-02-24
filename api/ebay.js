// api/ebay.js
import crypto from "crypto";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();

  // eBay webhook verification (leave as-is, but keep it deterministic)
  if (req.method === "GET" && req.query.challenge_code) {
    const challengeCode = req.query.challenge_code;

    const verificationToken =
      process.env.EBAY_VERIFICATION_TOKEN || "watchhunter123456789012345678901";

    const endpoint = "https://watch-hunter-proxy.vercel.app/api/ebay";
    const hash = crypto
      .createHash("sha256")
      .update(challengeCode + verificationToken + endpoint)
      .digest("hex");

    return res.status(200).json({ challengeResponse: hash });
  }

  // If you're not using webhooks, this is fine to acknowledge
  if (req.method === "POST") return res.status(200).json({ acknowledged: true });

  // Prefer modern names; keep backward compatibility
  const CLIENT_ID = process.env.EBAY_CLIENT_ID || process.env.EBAY_APP_ID;
  const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET || process.env.EBAY_CERT_ID;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).json({
      error:
        "Missing eBay credentials. Set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET (preferred).",
    });
  }

  // Default to PRODUCTION (your current code defaults to SANDBOX)
  const EBAY_ENV = (process.env.EBAY_ENV || "PRODUCTION").toUpperCase();
  const BASE = EBAY_ENV === "SANDBOX" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";

  try {
    // 1) OAuth token
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

    const tokenRes = await fetch(`${BASE}/identity/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body:
        "grant_type=client_credentials&scope=" +
        encodeURIComponent("https://api.ebay.com/oauth/api_scope"),
    });

    const tokenText = await tokenRes.text();
    let tokenData;
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      tokenData = { raw: tokenText };
    }

    if (!tokenRes.ok || !tokenData.access_token) {
      return res.status(502).json({
        error: "Failed to obtain eBay OAuth token",
        status: tokenRes.status,
        details: tokenData,
        env: EBAY_ENV,
      });
    }

    const token = tokenData.access_token;

    // 2) Browse search
    const q = req.query.q || req.query.query || "vintage watch";
    const maxPrice = req.query.maxPrice;
    const sort = req.query.sort || "newlyListed";
    const limit = req.query.limit || "50";

    const filters = ["buyingOptions:{AUCTION}", "itemLocationCountry:GB"];
    if (maxPrice) filters.push(`price:[..${maxPrice}],priceCurrency:GBP`);

    const params = new URLSearchParams({
      q: String(q),
      filter: filters.join(","),
      sort: String(sort),
      limit: String(limit),
    });

    const browseRes = await fetch(`${BASE}/buy/browse/v1/item_summary/search?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
        "Accept-Language": "en-GB",
      },
      cache: "no-store",
    });

    const browseText = await browseRes.text();
    let browseData;
    try {
      browseData = JSON.parse(browseText);
    } catch {
      browseData = { raw: browseText };
    }

    if (!browseRes.ok) {
      return res.status(502).json({
        error: "eBay browse search failed",
        status: browseRes.status,
        details: browseData,
        env: EBAY_ENV,
      });
    }

    return res.status(200).json(browseData);
  } catch (err) {
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
