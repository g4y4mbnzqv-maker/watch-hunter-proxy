import { caseSize, isPrecious } from "./caseDetails";
import { breakEven } from "./stock";
import { extractModelRef } from "./models";
import { extractModelName } from "./nicknames";

// A first draft of a sale listing for a watch in the sales log: a title,
// a description with gaps to fill in, and suggested prices. Nothing is
// posted anywhere; you copy what you want.

// eBay titles stop at 80 characters
const EBAY_TITLE_MAX = 80;

// Seller shouting that doesn't help a buyer find or trust the watch
const NOISE = /\b(l@@k|look|wow|rare|stunning|amazing|bargain|must see|no reserve|nr|vgc|bnwt|uk seller|free p&p|free postage)\b|[!*~]+/gi;

function tidy(title) {
  return String(title ?? "")
    .replace(NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Keeps whole words within the limit
function clip(text, max) {
  if (text.length <= max) return text;
  return text.slice(0, max + 1).replace(/\s+\S*$/, "");
}

// Title: brand first, then the rest of the original title without the noise,
// the case size added if the title had one but didn't lead with it
export function draftTitle(deal) {
  let title = tidy(deal.title);
  if (deal.brand && !title.toLowerCase().includes(deal.brand.toLowerCase())) title = `${deal.brand} ${title}`;
  const size = caseSize(deal.title);
  if (size && !/\d\s?mm\b/i.test(title)) title = `${title} ${size}mm`;
  return clip(title, EBAY_TITLE_MAX);
}

// Rounds to a price ending in 9, such as 249
function shopPrice(value) {
  if (!(value > 0)) return null;
  if (value < 20) return Math.round(value);
  return Math.max(Math.round((value + 1) / 10) * 10 - 1, 9);
}

// Suggested prices. eBay: list at the asking median with offers on, and
// accept nothing below the estimate or break-even. Vinted: 5% under, since
// Vinted buyers pay a protection fee on top.
export function draftPrices(deal, settings) {
  const asking = Number(deal.askingMedian) || Number(deal.estimate) || null;
  if (!asking) return null;
  const floor = Math.max(Number(deal.estimate) || 0, breakEven(deal, settings));
  const ebay = Math.max(shopPrice(asking), floor);
  return {
    ebay,
    lowestOffer: floor,
    vinted: Math.max(shopPrice(asking * 0.95), Math.ceil(Number(deal.boughtFor || 0))),
  };
}

export function draftDescription(deal, { platform = "ebay" } = {}) {
  const ref = extractModelRef(deal.title);
  const name = extractModelName(deal.title);
  const size = caseSize(deal.title);
  const lines = [
    draftTitle(deal),
    "",
    [
      deal.brand && `Brand: ${deal.brand}`,
      name && `Model: ${name.replace(new RegExp(`^${deal.brand} `, "i"), "")}`,
      ref && `Reference: ${ref}`,
      size && `Case size: ${size}mm (excluding crown)`,
      isPrecious(deal.title) && "Case: solid gold or platinum (state the hallmark)",
    ]
      .filter(Boolean)
      .join("\n"),
    "Movement: [automatic / quartz / manual wind]",
    "Condition: [describe any marks on the case, crystal and bracelet]",
    "Running: [tested over 24 hours, keeping good time / serviced in YEAR]",
    "Comes with: [box / papers / spare links / watch only]",
    "",
    "Genuine, and happy to send more photos or answer any questions.",
    platform === "ebay"
      ? "Sent Royal Mail Special Delivery, fully insured, within 1 working day."
      : "Sent tracked within 1 working day, well packed.",
  ];
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}
