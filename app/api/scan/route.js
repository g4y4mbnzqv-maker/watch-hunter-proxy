import { search, getItems } from "../../../lib/ebay";

export const dynamic = "force-dynamic";

function medianTopHalf(values) {
  if (!values || values.length < 5) return null;

  values.sort((a, b) => a - b);

  // remove lower 50% (cheap junk)
  const topHalf = values.slice(Math.floor(values.length / 2));

  const mid = Math.floor(topHalf.length / 2);

  return topHalf.length % 2 === 0
    ? (topHalf[mid - 1] + topHalf[mid]) / 2
    : topHalf[mid];
}

function timeLeftParts(endIso) {
  const end = new Date(endIso).getTime();
  const now = Date.now();
  const ms = Math.max(0, end - now);

  const totalHours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  return { daysLeft: days, hoursLeft: hours };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);

  const brand = searchParams.get("brand") || "seiko";
  const query = brand;

  // SOLD ITEMS
  const sold = await search({
    q: query,
    limit: 30,
    filter: "soldItems:true,itemLocationCountry:GB",
  });

  const soldPrices = (sold.itemSummaries || [])
    .map((i) => parseFloat(i.price?.value || 0))
    .filter((v) => v > 0);

  const baseline = medianTopHalf(soldPrices);

  if (!baseline) {
    return Response.json({ results: [] });
  }

  // LIVE AUCTIONS
  const live = await search({
    q: query,
    limit: 25,
    sort: "newlyListed",
    filter: "buyingOptions:{AUCTION},itemLocationCountry:GB,priceCurrency:GBP",
  });

  const summaries = live.itemSummaries || [];
  const itemIds = summaries.map((s) => s.itemId).filter(Boolean);

  const itemsResp = itemIds.length ? await getItems(itemIds) : { items: [] };
  const itemsById = new Map((itemsResp.items || []).map((it) => [it.itemId, it]));

  const MIN_DISCOUNT = 0.15;   // 15%
  const MAX_BID_FACTOR = 0.80; // 80% ceiling
  const MIN_BASELINE = 120;    // ignore low-value brands

  const results = summaries
    .map((s) => {
      const it = itemsById.get(s.itemId) || {};

      const endDate = it.itemEndDate || s.itemEndDate;
      const { daysLeft, hoursLeft } = endDate
        ? timeLeftParts(endDate)
        : { daysLeft: null, hoursLeft: null };

      const currentBid =
        parseFloat(
          it.currentBidPrice?.value ||
          s.currentBidPrice?.value ||
          it.price?.value ||
          s.price?.value ||
          0
        );

      const bidCount = it.bidCount ?? s.bidCount ?? 0;
      const bidderCount = it.uniqueBidderCount ?? null;

      const discount = 1 - currentBid / baseline;
      const maxBid = baseline * MAX_BID_FACTOR;

      return {
        title: s.title,
        image: s.image?.imageUrl,
        url: s.itemWebUrl,
        avgSold: baseline,
        discount,
        maxBid: Math.max(0, maxBid).toFixed(0),
        currentBid,
        bidCount,
        bidderCount,
        daysLeft,
        hoursLeft,
      };
    })
    .filter(
      (x) =>
        baseline > MIN_BASELINE &&
        x.discount >= MIN_DISCOUNT &&
        x.currentBid <= parseFloat(x.maxBid)
    )
    .sort((a, b) => b.discount - a.discount);

  return Response.json({ results });
}