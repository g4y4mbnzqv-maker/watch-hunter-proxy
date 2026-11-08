import { DEFAULT_SETTINGS } from "./profit";

// The price guide in the photo wizard, from the asking prices of the
// look-alike listings you ticked as the same watch.

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const round = (value) => Math.round(value * 100) / 100;

// { count, low, high, median, resale, maxPay, roughReason } from asking
// prices, or null with none. resale is what it would likely sell for at
// your expected sale price; maxPay is the most to pay, postage included,
// to still clear your target profit after fees and postage out.
export function photoGuide(prices, settings = DEFAULT_SETTINGS) {
  const list = prices.map(Number).filter((price) => price > 0);
  if (!list.length) return null;
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const mid = median(list);
  const resale = round(mid * (s.resalePercent / 100));
  const net = resale - resale * (s.sellingFeePercent / 100) - s.postageOut - s.extraCosts;
  const maxPay = Math.max(Math.floor(net - s.minProfit), 0);
  const low = Math.min(...list);
  const high = Math.max(...list);
  return {
    count: list.length,
    low,
    high,
    median: round(mid),
    resale,
    maxPay,
    roughReason:
      list.length < 3
        ? "only a few matches to go on"
        : low > 0 && high / low > 2.5
        ? "the matches' prices vary a lot"
        : null,
  };
}
