export const DEFAULT_SETTINGS = {
  // Share of the median Buy It Now asking price you expect to sell for
  resalePercent: 85,
  // eBay final value fee on your resale, as a percentage
  sellingFeePercent: 13,
  // What it costs you to post the watch to your buyer
  postageOut: 5,
  // Battery, service, cleaning or anything else per watch
  extraCosts: 0,
  // Profit a listing must clear to count as a deal
  minProfit: 30,
  // Sellers below either of these are flagged for caution
  sellerMinFeedback: 50,
  sellerMinPositive: 98,
};

// Works out resale, profit and the most you can bid for one auction.
// override is a resale value the user typed in, as { value, source } where
// source is "listing" or "model", or undefined to use the comparables.
export function analyse(item, settings, override) {
  const resale =
    override?.value ??
    (item.comps ? round(item.comps.median * (settings.resalePercent / 100)) : null);

  const postageIn = item.postage ?? 0;
  const buyCost = item.currentBid + postageIn;

  if (resale === null) {
    return { ...item, resale: null, resaleSource: null, profit: null, roi: null, maxBid: null, status: "unknown" };
  }

  const sellingFees = resale * (settings.sellingFeePercent / 100);
  const netResale = resale - sellingFees - settings.postageOut - settings.extraCosts;
  const profit = round(netResale - buyCost);
  const maxBid = Math.max(Math.floor(netResale - postageIn - settings.minProfit), 0);

  return {
    ...item,
    resale,
    resaleSource: override ? override.source : "comps",
    sellingFees: round(sellingFees),
    profit,
    roi: buyCost > 0 ? Math.round((profit / buyCost) * 100) : null,
    maxBid,
    status:
      profit >= settings.minProfit ? "deal" : profit > 0 ? "thin" : "loss",
  };
}

function round(value) {
  return Math.round(value * 100) / 100;
}
