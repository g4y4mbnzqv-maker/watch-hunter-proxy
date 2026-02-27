import { search, getItems } from "../../../lib/ebay";

export const dynamic = "force-dynamic";

function medianTopHalf(values) {
  if (!values || values.length < 5) return null;

  values.sort((a, b) => a - b);
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

  // SOLD ITEMS (NO COUNTRY FILTER)
  const sold = await search({
    q: brand,
    limit: 30,
    filter: "soldItems:true",
  });

  const soldPrices = (sold.itemSummaries || [])
    .map((i) => parseFloat(i.price?.value || 0))
    .filter((v) => v > 0);

  const baseline = medianTopHalf(soldPrices);

  // LIVE AUCTIONS (NO COUNTRY FILTER)
  const live = await search({
    q: brand,
    limit: 25,
    filter: "buyingOptions:{AUCTION}",
  });

  const summaries = live.itemSummaries || [];
  const itemIds = summaries.map((s) => s.itemId).filter(Boolean);

  const itemsResp = itemIds.length ? await getItems(itemIds) : { items: [] };
  const itemsById = new Map(
    (itemsResp.items || []).map((it) => [it.itemId, it])
  );

  const results = summaries.map((s) => {
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

    return {
      title: s.title,
      currentBid,
      bidCount: it.bidCount ?? s.bidCount ?? 0,
      bidderCount: it.uniqueBidderCount ?? null,
      daysLeft,
      hoursLeft,
      baseline,
    };
  });

  return Response.json({
    brand,
    baseline,
    soldCount: soldPrices.length,
    liveCount: summaries.length,
    results,
  });
}