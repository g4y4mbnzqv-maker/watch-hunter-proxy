export const dynamic = "force-dynamic";

export async function GET() {
  try {
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

    const text = await res.text();

    return Response.json({
      status: res.status,
      body: text,
    });
  } catch (err) {
    return Response.json({
      error: err.message,
    });
  }
}