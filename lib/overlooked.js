import { niche } from "./niche";

// Signs that fewer buyers will see or trust a listing, which tends to mean
// fewer bids: a misspelt brand, an auction ending overnight, one photo or a
// very short title.

// Common misspellings, by brand in lower case, from the app's niche file
export const TYPOS = niche.typos;

// The extra search for a brand's misspellings, or null when there are none
export function typoQuery(brand) {
  const words = TYPOS[brand.toLowerCase()];
  return words?.length ? `(${words.join(", ")})` : null;
}

// The misspelling in a title, or null. eBay sometimes corrects a search, so
// listings from the typo search only count if the title really has one.
export function misspelling(title, brand) {
  const words = TYPOS[brand.toLowerCase()] ?? [];
  const found = words.find((word) => new RegExp(`\\b${word}\\b`, "i").test(title));
  return found ?? null;
}

const ukTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23",
});

// "3:12am" when an auction ends between midnight and 7am UK time, else null
export function overnightEnd(endTime) {
  if (!endTime) return null;
  const parts = Object.fromEntries(ukTime.formatToParts(new Date(endTime)).map((part) => [part.type, part.value]));
  const hour = Number(parts.hour);
  if (hour >= 7) return null;
  return `${hour === 0 ? 12 : hour}:${parts.minute}am`;
}

// Titles shorter than this usually miss the model, reference or condition
const SHORT_TITLE = 30;

// Reasons fewer buyers may spot this listing, in plain words
export function overlookedReasons(item) {
  const reasons = [];
  if (item.misspelt) reasons.push(`the brand is misspelt "${item.misspelt}"`);
  const overnight = item.listingType !== "BUY_IT_NOW" && overnightEnd(item.endTime);
  if (overnight) reasons.push(`it ends at ${overnight}`);
  const photos = item.images?.length ?? (item.image ? 1 : 0);
  if (photos <= 1) reasons.push(photos ? "it has one photo" : "it has no photos");
  if (item.title && item.title.length < SHORT_TITLE) reasons.push("the title is short");
  return reasons;
}
