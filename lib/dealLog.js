// Watches you bought and sold, and what they say about the app's estimates.
// A deal is { id, itemId, title, brand, url, image, boughtOn, boughtFor, askingMedian,
// estimate, soldOn, soldFor, fees, postageOut, platform }. boughtFor includes
// postage. fees of null means the usual fees for the platform.

export const PLATFORMS = [
  { key: "ebay", label: "eBay" },
  { key: "vinted", label: "Vinted" },
  { key: "other", label: "Elsewhere" },
];

// Sales needed before the app suggests a new expected sale price
export const MIN_SALES_FOR_RATIO = 3;

const DAY_MS = 86_400_000;

export function isSold(deal) {
  return deal.soldFor !== null && deal.soldFor !== undefined && deal.soldFor !== "";
}

// Fees on a sale: what was entered, else the eBay fee from Settings. Vinted
// charges UK sellers nothing, and other places vary, so those default to 0.
export function dealFees(deal, settings) {
  if (!isSold(deal)) return 0;
  if (deal.fees !== null && deal.fees !== undefined && deal.fees !== "") return Number(deal.fees);
  return deal.platform === "ebay" ? round(Number(deal.soldFor) * (settings.sellingFeePercent / 100)) : 0;
}

// Profit on a sold watch, or null while it is unsold
export function dealProfit(deal, settings) {
  if (!isSold(deal)) return null;
  return round(Number(deal.soldFor) - dealFees(deal, settings) - Number(deal.postageOut || 0) - Number(deal.boughtFor || 0));
}

export function daysToSell(deal) {
  if (!isSold(deal) || !deal.boughtOn || !deal.soldOn) return null;
  return Math.max(Math.round((Date.parse(deal.soldOn) - Date.parse(deal.boughtOn)) / DAY_MS), 0);
}

export function summarise(deals, settings) {
  const sold = deals.filter(isSold);
  const unsold = deals.filter((deal) => !isSold(deal));
  const days = sold.map(daysToSell).filter((value) => value !== null);
  const sum = (list, value) => round(list.reduce((total, deal) => total + value(deal), 0));
  return {
    bought: deals.length,
    sold: sold.length,
    profit: sum(sold, (deal) => dealProfit(deal, settings)),
    revenue: sum(sold, (deal) => Number(deal.soldFor)),
    inStock: unsold.length,
    stockCost: sum(unsold, (deal) => Number(deal.boughtFor || 0)),
    medianDays: median(days),
  };
}

// What your watches sold for as a share of the median Buy It Now asking
// price when you bought them: the real figure behind "Expected sale price".
// Overall, and by brand where a brand has enough sales.
export function saleRatio(deals) {
  const usable = deals.filter((deal) => isSold(deal) && Number(deal.askingMedian) > 0);
  const percent = (list) => Math.round(median(list.map((deal) => (Number(deal.soldFor) / Number(deal.askingMedian)) * 100)));

  const brands = {};
  for (const deal of usable) (brands[deal.brand || "Other"] ??= []).push(deal);
  const byBrand = Object.entries(brands)
    .filter(([, list]) => list.length >= MIN_SALES_FOR_RATIO)
    .map(([brand, list]) => ({ brand, percent: percent(list), count: list.length }))
    .sort((a, b) => b.count - a.count);

  return {
    count: usable.length,
    percent: usable.length >= MIN_SALES_FOR_RATIO ? percent(usable) : null,
    byBrand,
  };
}

const CSV_COLUMNS = [
  ["Watch", (deal) => deal.title],
  ["Brand", (deal) => deal.brand],
  ["Bought on", (deal) => deal.boughtOn],
  ["Bought for (incl. postage)", (deal) => deal.boughtFor],
  ["Asking median when bought", (deal) => deal.askingMedian],
  ["Estimated resale", (deal) => deal.estimate],
  ["Sold on", (deal) => deal.soldOn],
  ["Sold for", (deal) => deal.soldFor],
  ["Sold on platform", (deal, settings) => (isSold(deal) ? PLATFORMS.find((p) => p.key === deal.platform)?.label : "")],
  ["Fees", (deal, settings) => (isSold(deal) ? dealFees(deal, settings) : "")],
  ["Postage out", (deal) => deal.postageOut],
  ["Profit", (deal, settings) => dealProfit(deal, settings)],
  ["eBay listing", (deal) => deal.url],
];

// A spreadsheet-ready copy, for backups and tax records
export function toCsv(deals, settings) {
  const cell = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    CSV_COLUMNS.map(([name]) => cell(name)).join(","),
    ...deals.map((deal) => CSV_COLUMNS.map(([, value]) => cell(value(deal, settings))).join(",")),
  ].join("\n");
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

// Your past sales of the same model as a title, newest first: by model
// reference, or by well-known name when there's no reference
export function pastSales(deals, title, keyOf) {
  const key = keyOf(title);
  if (!key) return [];
  return deals
    .filter((deal) => isSold(deal) && keyOf(deal.title) === key)
    .sort((a, b) => String(b.soldOn).localeCompare(String(a.soldOn)));
}
