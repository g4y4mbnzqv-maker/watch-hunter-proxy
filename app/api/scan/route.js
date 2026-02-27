import { search, getItems } from "../../../lib/ebay";

export const dynamic = "force-dynamic";

function avg(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
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

  // Sold comps for avg
  const sold = await search({
    q: query,
    limit: 20,
    filter: "soldItems:true,itemLocationCountry:GB",
  });

  const soldPrices = (sold.itemSummaries || [])
    .map((i) => parseFloat(i.price?.value || 0))
    .filter(Boolean);

  if (soldPrices.length < 5) {
    return Response.json({ results: [] });
  }

  const avgSold = avg(soldPrices);

  // Live auctions (brand-only)
  const live = await search({
    q: query,
    limit: 20,
    sort: "newlyListed",
    filter: "buyingOptions:{AUCTION},itemLocationCountry:GB,priceCurrency:GBP",
  });

  const summaries = live.itemSummaries || [];
  const itemIds = summaries.map((s) => s.itemId).filter(Boolean);

  // Pull auction stats including uniqueBidderCount
  const itemsResp = itemIds.length ? await getItems(itemIds) : { items: [] };
  const itemsById = new Map((itemsResp.items || []).map((it) => [it.itemId, it]));

  const MIN_DISCOUNT = 0.35;
  const MAX_BID_FACTOR = 0.70;

  const results = summaries
    .map((s) => {
      const it = itemsById.get(s.itemId) || {};

      const endDate = it.itemEndDate || s.itemEndDate; // both exist, getItems is authoritative
      const { daysLeft, hoursLeft } = endDate ? timeLeftParts(endDate) : { daysLeft: null, hoursLeft: null };

      // Current bid (prefer currentBidPrice for auctions; fallback to price)
      const currentBid =
        parseFloat(it.currentBidPrice?.value || s.currentBidPrice?.value || it.price?.value || s.price?.value || 0);

      const bidCount = it.bidCount ?? s.bidCount ?? 0;
      const bidderCount = it.uniqueBidderCount ?? null; // from getItems

      const discount = 1 - currentBid / avgSold;
      const maxBid = avgSold * MAX_BID_FACTOR;

      return {
        title: s.title,
        image: s.image?.imageUrl,
        url: s.itemWebUrl,

        // opportunity logic
        avgSold,
        discount,
        maxBid: Math.max(0, maxBid).toFixed(0),

        // requested auction stats
        currentBid,
        bidCount,
        bidderCount,
        daysLeft,
        hoursLeft,
      };
    })
    .filter((x) => x.discount >= MIN_DISCOUNT && x.currentBid <= parseFloat(x.maxBid))
    .sort((a, b) => b.discount - a.discount);

  return Response.json({ results });
}