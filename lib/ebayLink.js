// Turns an eBay link, as pasted or shared from the eBay app, into an item
// number. Share links (ebay.io, ebay.us) redirect to the listing, so the
// server follows them, only ever to eBay's own addresses.

// Hosts that eBay's share buttons use
const SHORT_HOSTS = ["ebay.io", "ebay.us", "ebay.to"];
// eBay's own sites: ebay.co.uk, www.ebay.com, m.ebay.co.uk and so on
const EBAY_HOST = /(^|\.)ebay\.(co\.uk|com|ie|de|fr|it|es|nl|at|ch|ca|com\.au)$/i;
// Redirects followed before giving up
const MAX_HOPS = 5;
// Only the start of a redirect page is read when it has no Location header
const MAX_PAGE_CHARS = 200_000;

// The first web address in shared text such as "Check this out on eBay
// https://ebay.io/m/abc", or the text itself when it is a bare item number
export function linkFromText(text) {
  const trimmed = String(text ?? "").trim();
  if (/^\d{9,15}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/https?:\/\/[^\s<>"']+/i);
  if (match) return match[0].replace(/[).,]+$/, "");
  // "ebay.io/m/abc" pasted without https://
  const bare = trimmed.match(/(?:^|\s)((?:[\w-]+\.)*ebay\.[a-z.]+\/[^\s<>"']+)/i);
  return bare ? `https://${bare[1]}` : null;
}

function parse(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed : null;
  } catch {
    return null;
  }
}

export function isShortLink(url) {
  const parsed = parse(url);
  return Boolean(parsed && SHORT_HOSTS.includes(parsed.hostname.toLowerCase()));
}

export function isEbayUrl(url) {
  const parsed = parse(url);
  return Boolean(parsed && (EBAY_HOST.test(parsed.hostname) || SHORT_HOSTS.includes(parsed.hostname.toLowerCase())));
}

// The listing's item number from a full eBay address, or null
export function itemNumber(link) {
  if (/^\d{9,15}$/.test(String(link ?? "").trim())) return String(link).trim();
  const parsed = parse(link);
  if (!parsed || !EBAY_HOST.test(parsed.hostname)) return null;
  // /itm/123456789012 or /itm/seiko-diver/123456789012
  const path = parsed.pathname.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})(?:[/?]|$)/);
  if (path) return path[1];
  const query = parsed.searchParams.get("item") || parsed.searchParams.get("itemId");
  return query && /^\d{9,15}$/.test(query) ? query : null;
}

// An item number in a page's HTML, for share links that redirect by page
// rather than by header
function itemInPage(html) {
  const match = html.slice(0, MAX_PAGE_CHARS).match(/https?:\\?\/\\?\/(?:[\w-]+\.)*ebay\.[a-z.]+\\?\/itm\\?\/(?:[^"'\s<>]*?\\?\/)?(\d{9,15})/i);
  return match ? match[1] : null;
}

// Follows a share link to the listing and returns its item number, or null.
// Stops at the first address that isn't eBay's.
export async function resolveItemNumber(link, fetchImpl = fetch) {
  let url = link;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const found = itemNumber(url);
    if (found) return found;
    if (!isEbayUrl(url)) return null;

    const res = await fetchImpl(url, { redirect: "manual", cache: "no-store", headers: { Accept: "text/html" } });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url).toString();
      continue;
    }
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "";
    return type.includes("html") ? itemInPage(await res.text()) : null;
  }
  return null;
}
