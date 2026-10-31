import { isSpecialEdition } from "./wording";
import { isTooCheap } from "./fakes";
import { brandFromTitle } from "./brands";

// An estimate from fewer Buy It Now listings than this is rough
const ROUGH_BELOW_COUNT = 4;
// ...as is one where the dearest listing costs this many times the cheapest
const ROUGH_SPREAD = 2.5;

export const DEFAULT_SETTINGS = {
  // Share of the median Buy It Now asking price you expect to sell for
  resalePercent: 85,
  // eBay final value fee on your resale, as a percentage
  sellingFeePercent: 13,
  // What it costs you to post the watch to your buyer
  postageOut: 5,
  // Vinted's fee on your sale, as a percentage. UK sellers pay none, and
  // the buyer pays postage.
  vintedFeePercent: 0,
  // Battery, service, cleaning or anything else per watch
  extraCosts: 0,
  // Profit a listing must clear to count as a deal
  minProfit: 30,
  // Hide auctions already costing more than this; 0 means no limit
  maxBudget: 0,
  // Sellers below either of these are flagged for caution
  sellerMinFeedback: 50,
  sellerMinPositive: 98,
  // Expected sale price by brand, from your own sales: { Seiko: 80 }.
  // Brands not listed use resalePercent.
  brandResalePercent: {},
};

// The expected sale price to use for a listing: your own figure for its
// brand where you have one. Returns { percent, brand } where brand is set
// only when a brand figure applied.
export function resalePercentFor(item, settings) {
  const brand = item.brand || brandFromTitle(item.title);
  const own = brand && settings.brandResalePercent?.[brand];
  return own > 0 ? { percent: own, brand } : { percent: settings.resalePercent, brand: null };
}

// Works out resale, profit and the most you can bid for one auction.
// override is a resale value the user typed in, as { value, source } where
// source is "listing" or "model", or undefined to use the comparables.
export function analyse(item, settings, override) {
  const share = resalePercentFor(item, settings);
  const resale =
    override?.value ??
    (item.comps ? round(item.comps.median * (share.percent / 100)) : null);

  const postageIn = item.postage ?? 0;
  const buyCost = item.currentBid + postageIn;

  if (resale === null) {
    return { ...item, resale: null, resaleSource: null, profit: null, roi: null, maxBid: null, status: "unknown" };
  }

  // Your own values are trusted; estimates get checked for warning signs
  const roughReasons = override ? [] : roughEstimateReasons(item);
  // A price far below every genuine listing needs checking whatever the value
  const tooCheap = isTooCheap(item);

  const sellingFees = resale * (settings.sellingFeePercent / 100);
  const netResale = resale - sellingFees - settings.postageOut - settings.extraCosts;
  const profit = round(netResale - buyCost);
  // Sold on Vinted instead: its own fee (none for UK sellers) and the
  // buyer pays postage
  const vintedProfit = round(
    resale - resale * ((settings.vintedFeePercent ?? 0) / 100) - settings.extraCosts - buyCost
  );
  const profitLimit = Math.max(Math.floor(netResale - postageIn - settings.minProfit), 0);
  // Never suggest bidding past Maximum spend, which includes postage
  const budgetLimit =
    settings.maxBudget > 0 ? Math.max(Math.floor(settings.maxBudget - postageIn), 0) : Infinity;
  const maxBid = Math.min(profitLimit, budgetLimit);

  return {
    ...item,
    resale,
    resaleSource: override ? override.source : "comps",
    // Set when your own sales figure for the brand set the resale value
    brandPercent: !override && share.brand ? share : null,
    sellingFees: round(sellingFees),
    profit,
    vintedProfit,
    roi: buyCost > 0 ? Math.round((profit / buyCost) * 100) : null,
    maxBid,
    budgetCapped: budgetLimit < profitLimit,
    tooCheap,
    roughReasons,
    // A big profit on a shaky estimate needs checking before it counts
    status:
      profit >= settings.minProfit
        ? roughReasons.length || tooCheap
          ? "check"
          : "deal"
        : profit > 0
        ? "thin"
        : "loss",
  };
}

// Why an estimate from Buy It Now listings might be far out, if at all
export function roughEstimateReasons(item) {
  const reasons = [];
  const comps = item.comps;

  if (comps?.count < ROUGH_BELOW_COUNT) {
    reasons.push(`only ${comps.count} listings to go on`);
  }
  if (comps?.low > 0 && comps.high / comps.low > ROUGH_SPREAD) {
    reasons.push("asking prices vary a lot");
  }
  if (isSpecialEdition(item.title)) {
    reasons.push("special or limited edition");
  }

  return reasons;
}

function round(value) {
  return Math.round(value * 100) / 100;
}
