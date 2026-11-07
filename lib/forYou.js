import { brandFromTitle } from "./brands";
import { extractModelRef, modelKey } from "./models";
import { extractModelName } from "./nicknames";

// "For you": listings ranked by how much they look like the watches you
// save and buy. Brands, price range and models count; a watch you bought
// counts twice as much as one you saved.

// Picks needed before the ranking means anything
export const MIN_PICKS = 5;
const BOUGHT_WEIGHT = 2;

function keyFor(item) {
  const modelRef = item.modelRef ?? extractModelRef(item.title);
  return modelKey({ modelRef, modelName: modelRef ? null : item.modelName ?? extractModelName(item.title) });
}

// What your saves and buys have in common: { count, brands, topBrand,
// price, models }, where price is the typical price you go for
export function buildTaste({ watchlist = {}, deals = [] } = {}) {
  const picks = [
    ...Object.values(watchlist ?? {}).map((item) => ({ item, price: Number(item.totalCost), weight: 1 })),
    ...(deals ?? []).map((deal) => ({ item: deal, price: Number(deal.boughtFor), weight: BOUGHT_WEIGHT })),
  ].filter(({ item }) => item?.title);

  const brands = {};
  const models = new Set();
  const prices = [];
  for (const { item, price, weight } of picks) {
    const brand = item.brand || brandFromTitle(item.title);
    if (brand) brands[brand] = (brands[brand] ?? 0) + weight;
    const key = keyFor(item);
    if (key) models.add(key);
    if (price > 0) for (let i = 0; i < weight; i++) prices.push(Math.log(price));
  }
  prices.sort((a, b) => a - b);
  const middle = Math.floor(prices.length / 2);
  const logPrice = prices.length ? (prices.length % 2 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2) : null;

  return {
    count: picks.length,
    brands,
    topBrand: Math.max(0, ...Object.values(brands)),
    price: logPrice === null ? null : Math.round(Math.exp(logPrice)),
    models,
  };
}

// How well a listing matches your picks, from 0 to 1
export function scoreFor(item, taste) {
  if (!taste?.count) return 0;
  const brand = item.brand || brandFromTitle(item.title);
  const brandScore = brand && taste.topBrand ? (taste.brands[brand] ?? 0) / taste.topBrand : 0;
  const priceScore =
    taste.price && item.totalCost > 0 ? Math.exp(-1.5 * Math.abs(Math.log(item.totalCost / taste.price))) : 0;
  const key = keyFor(item);
  const modelScore = key && taste.models.has(key) ? 1 : 0;
  return Math.round((0.5 * brandScore + 0.35 * priceScore + 0.15 * modelScore) * 100) / 100;
}
