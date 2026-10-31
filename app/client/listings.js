import { formatGbp, formatTimeLeft, hoursLeft } from "../components/format";
import { analyse } from "@/lib/profit";
import { assessSeller } from "@/lib/seller";
import { conditionGrade } from "@/lib/condition";
import { overlookedReasons } from "@/lib/overlooked";
import { oftenFakedBrand } from "@/lib/fakes";

// Listing fields kept for each saved listing, so the watchlist shows
// without a scan and survives the listing ending
export const SNAPSHOT_FIELDS = [
  "itemId", "title", "url", "image", "condition", "modelRef", "currentBid",
  "postage", "totalCost", "bidCount", "endTime", "seller", "comps", "brand",
  "conditionId", "images", "listingType", "bestOffer", "modelName", "misspelt",
  "authenticityGuarantee",
];

export const SORTERS = {
  profit: (a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity),
  roi: (a, b) => (b.roi ?? -Infinity) - (a.roi ?? -Infinity),
  headroom: (a, b) =>
    (b.maxBid === null ? -Infinity : b.maxBid - b.currentBid) -
    (a.maxBid === null ? -Infinity : a.maxBid - a.currentBid),
  // Buy It Now listings have no end time, so they go after every auction
  ending: (a, b) => endMs(a) - endMs(b),
};

function endMs(item) {
  return item.endTime ? new Date(item.endTime).getTime() : Infinity;
}

// Buy It Now listings stay live until eBay stops returning them
export function isLive(item, now) {
  return item.listingType === "BUY_IT_NOW" || hoursLeft(item.endTime, now) > 0;
}

export function endsWithin(item, now, hours) {
  return item.listingType !== "BUY_IT_NOW" && hoursLeft(item.endTime, now) < hours;
}

// Adds profit, seller and condition checks to each listing. Doesn't depend
// on the time, so it only reruns when listings, settings or values change.
export function analyseAll(items, settings, resaleOverride) {
  return items.map((item) => ({
    ...analyse(item, settings, resaleOverride(item)),
    sellerCheck: assessSeller(item.seller, settings),
    conditionCheck: conditionGrade(item),
    overlooked: overlookedReasons(item),
    oftenFaked: oftenFakedBrand(item),
  }));
}

export function pick(object, fields) {
  return Object.fromEntries(
    fields.filter((field) => field in object).map((field) => [field, object[field]])
  );
}

// "Hidden: 3 from risky sellers, 2 over your £200 limit", or null
export function hiddenNote(parts) {
  const text = parts.filter(Boolean).join(", ");
  return text ? `Hidden: ${text}` : null;
}

// Runs fn over items with at most limit in flight, in order of results
export async function runPool(items, limit, fn) {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

// Shows a notification through the service worker where there is one, as
// Android requires, or straight from the page otherwise
// With final, it's the last call: the auction is about to end
export async function notify(item, now, { final = false } = {}) {
  const left = formatTimeLeft(item.endTime, now);
  const title = final ? `Bid now, ${left} left: ${item.title}` : `Ends in ${left}: ${item.title}`;
  const options = {
    body:
      item.maxBid !== null
        ? `Now ${formatGbp(item.totalCost)}. Bid up to ${formatGbp(item.maxBid)}.`
        : `Now ${formatGbp(item.totalCost)}.`,
    // A separate tag, so the last call shows even after the first alert
    tag: final ? `${item.itemId}-final` : item.itemId,
    icon: "/icons/icon-192.png",
    data: { url: item.url },
  };

  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
  } catch (err) {
    // The banner still shows the auction
    console.error(err);
  }
}
