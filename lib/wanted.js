// Your wanted list: models you're after and the most you'd pay, such as
// "Seiko SKX007" under £180. The hourly alert check, and "Search now" in the
// app, look for listings at or under your price.

// Each wanted model costs about two eBay searches per alert check
export const MAX_WANTED = 15;
// Auction bids rise towards the end, so an auction only counts when it
// ends within this many hours and is still at or under your price
export const AUCTION_WINDOW_HOURS = 3;

// The list as saved, tidied: a model name and a positive price each, no
// repeats, within the limit
export function cleanWanted(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const kept = [];
  for (const want of list) {
    const query = String(want?.query ?? "").trim();
    const maxPrice = Number(want?.maxPrice);
    if (!query || !(maxPrice > 0) || seen.has(query.toLowerCase())) continue;
    seen.add(query.toLowerCase());
    kept.push({ id: String(want.id ?? query.toLowerCase()), query, maxPrice });
  }
  return kept.slice(0, MAX_WANTED);
}

// True when a listing is at or under your price: any time for Buy It Now,
// and in the last few hours for an auction
export function matchesWanted(item, want, now = Date.now()) {
  if (!(item.totalCost > 0) || item.totalCost > want.maxPrice) return false;
  if (item.listingType === "BUY_IT_NOW") return true;
  if (!item.endTime) return false;
  const hoursLeft = (Date.parse(item.endTime) - now) / 3_600_000;
  return hoursLeft > 0 && hoursLeft <= AUCTION_WINDOW_HOURS;
}
