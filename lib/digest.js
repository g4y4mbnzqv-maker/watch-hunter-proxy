import { summarise } from "./dealLog";
import { weeklyReview } from "./review";

// Price drops on saved Buy It Now listings, and the Sunday evening summary.
// The sums live here so they can be tested without a database.

// A drop smaller than both of these isn't worth a notification
const MIN_DROP_POUNDS = 5;
const MIN_DROP_SHARE = 0.05;

// The summary goes out on the first check from this hour on Sundays, UK time
export const SUMMARY_HOUR = 18;

// Deals found by alert checks are remembered this long for "best deal found"
export const RECENT_DEAL_DAYS = 7;
const DAY_MS = 86_400_000;

// True when the price fell by at least £5 or 5%, whichever is more
export function isPriceDrop(before, now) {
  if (!(before > 0) || !(now > 0)) return false;
  return before - now >= Math.max(MIN_DROP_POUNDS, before * MIN_DROP_SHARE);
}

export function priceDropNotification({ item, before }) {
  const now = Math.round(item.totalCost);
  return {
    title: `Price drop: £${Math.round(before)} to £${now}`,
    body: `${item.title} is now £${now} with postage, down £${Math.round(before - item.totalCost)}.`,
    url: item.url,
    tag: `drop-${item.itemId}`,
  };
}

const ukParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "short",
  hour: "numeric",
  hourCycle: "h23",
});

// True on Sunday from SUMMARY_HOUR, UK time
export function isSummaryTime(now = new Date()) {
  const parts = Object.fromEntries(ukParts.formatToParts(now).map((part) => [part.type, part.value]));
  return parts.weekday === "Sun" && Number(parts.hour) >= SUMMARY_HOUR;
}

// Deals found by alert checks in the last week, newest first, at most 50
export function keepRecentDeals(list, found, now = Date.now()) {
  const fresh = found.map((item) => ({ at: now, profit: item.profit, title: item.title, url: item.url }));
  return [...fresh, ...(Array.isArray(list) ? list : [])]
    .filter((deal) => deal && now - deal.at < RECENT_DEAL_DAYS * DAY_MS)
    .slice(0, 50);
}

// The week in one notification: sales and profit, stock, and the best deal
// the alert checks found
export function weeklySummary({ deals = [], settings, recentDeals = [], now = Date.now() }) {
  const { week } = weeklyReview(deals, settings, { now });
  const stock = summarise(deals, settings);
  const best = recentDeals.reduce((top, deal) => (!top || deal.profit > top.profit ? deal : top), null);

  const lines = [
    week.sold
      ? `Sold ${week.sold} for £${week.profit} profit.`
      : "No sales logged this week.",
    week.bought ? `Bought ${week.bought} for £${week.spent}.` : null,
    stock.inStock ? `${stock.inStock} in stock (£${Math.round(stock.stockCost)} paid).` : null,
    best ? `Best deal found: £${Math.round(best.profit)} on ${best.title}.` : null,
  ].filter(Boolean);

  return {
    title: week.sold ? `Your week: £${week.profit} profit` : "Your week in Watch Hunter",
    body: lines.join(" "),
    url: "/",
    tag: "weekly-summary",
  };
}
