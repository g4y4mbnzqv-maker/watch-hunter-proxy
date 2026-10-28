import { NextResponse } from "next/server";
import { AUTH_COOKIE, passcodeToken } from "@/lib/passcode";

// When APP_PASSCODE is set, every page and API route needs the unlock
// cookie. Without it the app is open, as before.
export async function middleware(req) {
  const passcode = process.env.APP_PASSCODE;
  if (!passcode) return NextResponse.next();

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (cookie && cookie === (await passcodeToken(passcode))) {
    return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return Response.json(
      { error: true, message: "Locked. Reload the page and enter your passcode." },
      { status: 401 }
    );
  }

  const url = req.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // The unlock page and the files a phone needs to install the app stay open
  matcher: [
    "/((?!unlock|api/unlock|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/).*)",
  ],
};
