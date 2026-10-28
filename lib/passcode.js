export const AUTH_COOKIE = "wh_auth";

// The cookie holds a hash of the passcode, so changing APP_PASSCODE signs
// every browser out. Uses Web Crypto so it also runs in middleware.
export async function passcodeToken(passcode) {
  const data = new TextEncoder().encode(`watch-hunter:${passcode}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
