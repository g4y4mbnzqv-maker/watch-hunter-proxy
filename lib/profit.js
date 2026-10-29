import { isSpecialEdition } from "./wording";
import { isTooCheap } from "./fakes";
import { niche } from "./niche";

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
  // Battery, service, cleaning or anything else per watch
  extraCosts: 0,
  // Profit a listing must clear to count as a deal
  minProfit: 30,
  // Hide auctions already costing more than this; 0 means no limit
  maxBudget: 0,
  // Sellers below either of these are flagged for caution
  sellerMinFeedback: 50,
  sellerMinPositive: 98,
  // Bike Hunter only: scans limited to bikes collectable within this many
  // miles of the postcode; 0 means anywhere in the UK
  postcode: "",
  collectionMiles: 0,
  // Each app can change the defaults, such as no postage out for bikes
  ...niche.settings,
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

  // Your own values are trusted; estimates get checked for warning signs
  const roughReasons = override ? [] : roughEstimateReasons(item);
  // A price far below every genuine listing needs checking whatever the value
  const tooCheap = isTooCheap(item);

  const sellingFees = resale * (settings.sellingFeePercent / 100);
  const netResale = resale - sellingFees - settings.postageOut - settings.extraCosts;
  const profit = round(netResale - buyCost);
  const profitLimit = Math.max(Math.floor(netResale - postageIn - settings.minProfit), 0);
  // Never suggest bidding past Maximum spend, which includes postage
  const budgetLimit =
    settings.maxBudget > 0 ? Math.max(Math.floor(settings.maxBudget - postageIn), 0) : Infinity;
  const maxBid = Math.min(profitLimit, budgetLimit);

  return {
    ...item,
    resale,
    resaleSource: override ? override.source : "comps",
    sellingFees: round(sellingFees),
    profit,
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
