import { finishSignIn } from "@/lib/ebaySell";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "wh_ebay_state";

// eBay sends you back here after you sign in
export async function GET(req) {
  const url = new URL(req.url);
  const back = (outcome) =>
    new Response(null, {
      status: 302,
      headers: {
        Location: new URL(`/?ebay=${outcome}`, req.url).toString(),
        "Set-Cookie": `${STATE_COOKIE}=; Path=/api/ebay; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
      },
    });

  const cookie = req.headers.get("cookie") ?? "";
  const expected = cookie.match(new RegExp(`${STATE_COOKIE}=([a-f0-9]+)`))?.[1];
  const code = url.searchParams.get("code");
  if (!code || !expected || url.searchParams.get("state") !== expected) return back("error");
  try {
    await finishSignIn(code);
    return back("connected");
  } catch (err) {
    console.error(err);
    return back("error");
  }
}
