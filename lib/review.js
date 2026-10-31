import { daysToSell, dealProfit, isSold } from "./dealLog";

// A summary of how the business is doing, for the Sales tab: the last 7 and
// 30 days, which brands earn and which don't, and which models' prices are
// moving. Worked out from your sales log and the price index; nothing is
// sent anywhere.

// Brands need this many sales before they're called best or worst
const MIN_BRAND_SALES = 2;
// Price moves smaller than this aren't worth mentioning
const MIN_MOVE_PERCENT = 5;

const DAY_MS = 86_400_000;

function within(date, days, now) {
  return date && now - Date.parse(date) <= days * DAY_MS && Date.parse(date) <= now;
}

function period(deals, settings, days, now) {
  const sold = deals.filter((deal) => isSold(deal) && within(deal.soldOn, days, now));
  const bought = deals.filter((deal) => within(deal.boughtOn, days, now));
  return {
    sold: sold.length,
    profit: Math.round(sold.reduce((total, deal) => total + dealProfit(deal, settings), 0)),
    bought: bought.length,
    spent: Math.round(bought.reduce((total, deal) => total + Number(deal.boughtFor || 0), 0)),
  };
}

// Brands by average profit per watch sold, with their average days to sell
export function brandResults(deals, settings) {
  const brands = {};
  for (const deal of deals.filter(isSold)) (brands[deal.brand || "Other"] ??= []).push(deal);
  return Object.entries(brands)
    .map(([brand, list]) => {
      const days = list.map(daysToSell).filter((value) => value !== null);
      return {
        brand,
        count: list.length,
        profit: Math.round(list.reduce((total, deal) => total + dealProfit(deal, settings), 0)),
        average: Math.round(list.reduce((total, deal) => total + dealProfit(deal, settings), 0) / list.length),
        days: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null,
      };
    })
    .sort((a, b) => b.average - a.average);
}

// The biggest 30-day price moves in the price index, up and down
export function priceMovers(models, limit = 3) {
  const moving = (models ?? []).filter((model) => model.change && Math.abs(model.change.percent) >= MIN_MOVE_PERCENT);
  const byMove = (a, b) => b.change.percent - a.change.percent;
  return {
    rising: moving.filter((model) => model.change.percent > 0).sort(byMove).slice(0, limit),
    falling: moving.filter((model) => model.change.percent < 0).sort(byMove).reverse().slice(0, limit),
  };
}

export function weeklyReview(deals, settings, { now = Date.now(), models = [] } = {}) {
  const brands = brandResults(deals, settings).filter((row) => row.count >= MIN_BRAND_SALES);
  const best = brands[0] ?? null;
  const worst = brands.length > 1 ? brands[brands.length - 1] : null;
  return {
    week: period(deals, settings, 7, now),
    month: period(deals, settings, 30, now),
    best,
    worst: worst && worst.brand !== best?.brand ? worst : null,
    movers: priceMovers(models),
  };
}
