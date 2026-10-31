import { brandFromTitle } from "./brands";

// Hidden gems: cheap listings whose titles don't name a brand, such as "old
// gents watch" or "vintage automatic". Sellers who don't know what they
// have often list like this, and the photos may show a better watch than
// the title says. There's no model to price them by, so you judge them by
// eye; the app just finds them.

// Searches that catch vague listings in eBay's wristwatch category
export const GEM_QUERIES = [
  "vintage watch",
  "old watch",
  "gents watch",
  "automatic watch",
  "mechanical watch",
  "wind up watch",
  "dress watch",
  "military watch",
];

// Cheap enough to take a punt on
export const GEM_MAX_PRICE = 80;

// True for a listing worth a look: no known brand in the title and cheap
export function isGem(item, maxPrice = GEM_MAX_PRICE) {
  return !brandFromTitle(item.title) && item.totalCost > 0 && item.totalCost <= maxPrice;
}
