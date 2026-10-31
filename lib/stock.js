import { isSold } from "./dealLog";

// Reminders for watches still in stock, and suggested prices when one
// isn't selling. Deals can carry listedOn (a date) and listedAt (a price).

// A watch bought this long ago and not yet listed gets a nudge
export const LIST_WITHIN_DAYS = 7;
// A listing this old without a sale gets a suggested price drop
export const STALE_LISTING_DAYS = 21;
// The suggested drop, as a share of the current price
const PRICE_DROP = 0.1;

const DAY_MS = 86_400_000;

function daysSince(date, now) {
  return date ? Math.floor((now - Date.parse(date)) / DAY_MS) : null;
}

// The lowest price that gets your money back on eBay: what you paid plus
// postage to the buyer, after eBay's fee
export function breakEven(deal, settings) {
  const cost = Number(deal.boughtFor || 0) + Number(deal.postageOut || settings.postageOut || 0);
  return Math.ceil(cost / (1 - settings.sellingFeePercent / 100));
}

// Rounds down to a price ending in 9, such as 249 or 95 to 89
function shopPrice(value) {
  if (value < 20) return Math.floor(value);
  return Math.max(Math.floor((value + 1) / 10) * 10 - 1, 9);
}

// What needs doing about each unsold watch, oldest first. Each reminder is
// { deal, kind, days, suggestion } where kind is "unlisted" or "stale" and
// suggestion is a new price, or null when the price is already at break-even.
export function stockReminders(deals, settings, now = Date.now()) {
  const reminders = [];
  for (const deal of deals) {
    if (isSold(deal)) continue;
    const listedDays = daysSince(deal.listedOn, now);
    const listedAt = Number(deal.listedAt) || 0;
    if (listedDays === null) {
      const held = daysSince(deal.boughtOn, now);
      if (held !== null && held >= LIST_WITHIN_DAYS) reminders.push({ deal, kind: "unlisted", days: held, suggestion: null });
      continue;
    }
    if (listedDays >= STALE_LISTING_DAYS && listedAt > 0) {
      const floor = breakEven(deal, settings);
      const dropped = shopPrice(listedAt * (1 - PRICE_DROP));
      const suggestion = listedAt <= floor ? null : Math.max(dropped, floor);
      reminders.push({ deal, kind: "stale", days: listedDays, suggestion });
    }
  }
  return reminders.sort((a, b) => b.days - a.days);
}
