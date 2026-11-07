import { authorizeUrl, newState, sellUnavailable } from "@/lib/ebaySell";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "wh_ebay_state";

// Sends you to eBay to sign in and allow the app to list your watches
export async function GET(req) {
  const unavailable = sellUnavailable();
  if (unavailable) {
    return Response.redirect(new URL(`/?ebay=error&reason=${unavailable}`, req.url), 302);
  }
  const state = newState();
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl(state),
      // Checked on the way back, so only a sign-in started here is accepted
      "Set-Cookie": `${STATE_COOKIE}=${state}; Path=/api/ebay; Max-Age=900; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}
