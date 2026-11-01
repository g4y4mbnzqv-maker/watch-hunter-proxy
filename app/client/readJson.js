// Reads a JSON reply from the app's own API. When something in between
// answers instead (Vercel's error page after a time-out, or a lost
// connection), the reply isn't JSON; this turns that into a plain message
// instead of "Unexpected token <".
export async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    const message =
      res.status === 504 || res.status === 502
        ? "eBay took too long to answer. Try again in a moment."
        : `The server didn't answer properly (${res.status}). Try again in a moment.`;
    return { error: true, message };
  }
}
