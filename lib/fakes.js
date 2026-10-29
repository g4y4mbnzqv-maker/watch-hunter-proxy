import { brandFromTitle } from "./brands";
import { niche } from "./niche";

// Brands faked often enough that every listing deserves a closer look
const OFTEN_FAKED = niche.oftenFaked;

// A Buy It Now price below this share of the cheapest comparable listing is
// more likely a fake, a part or a mistake than a bargain
export const TOO_CHEAP_SHARE = 0.5;

// The listing's brand when it's one of the often-faked ones, or null
export function oftenFakedBrand(item) {
  const brand = item.brand || brandFromTitle(item.title);
  if (!brand) return null;
  return OFTEN_FAKED.find((name) => name.toLowerCase() === brand.toLowerCase()) ?? null;
}

// True when a Buy It Now price sits far below every comparable listing.
// Auctions are left out: a low bid hours before the end is normal.
export function isTooCheap(item) {
  if (item.listingType !== "BUY_IT_NOW" || !(item.comps?.low > 0)) return false;
  return item.currentBid + (item.postage ?? 0) < item.comps.low * TOO_CHEAP_SHARE;
}
