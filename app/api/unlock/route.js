import { AUTH_COOKIE, passcodeToken } from "@/lib/passcode";

export const dynamic = "force-dynamic";

// Signed-in browsers stay unlocked for this long
const COOKIE_MAX_AGE = 90 * 24 * 60 * 60;
// Slows down anyone trying passcodes one after another
const WRONG_PASSCODE_DELAY_MS = 1000;

export async function POST(req) {
  const passcode = process.env.APP_PASSCODE;
  if (!passcode) return Response.json({ ok: true });

  const { passcode: attempt } = await req.json().catch(() => ({}));

  if (typeof attempt !== "string" || attempt !== passcode) {
    await new Promise((resolve) => setTimeout(resolve, WRONG_PASSCODE_DELAY_MS));
    return Response.json(
      { error: true, message: "That passcode isn't right" },
      { status: 401 }
    );
  }

  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `${AUTH_COOKIE}=${await passcodeToken(passcode)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`
  );
  return res;
}
