import { search } from "../../../lib/ebay";

export const dynamic = "force-dynamic";

function avg(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);

  const brand = searchParams.get("brand") || "seiko";

  const query = brand; // brand only

  const sold = await search({
    q: query,
    limit: 20,
    filter: "soldItems:true,itemLocationCountry:GB",
  });

  const soldPrices = sold.itemSummaries
    ?.map(i => parseFloat(i.price?.value || 0))
    .filter(Boolean);

  if (!soldPrices || soldPrices.length < 5) {
    return Response.json({ results: [] });
  }

  const avgSold = avg(soldPrices);

  const live = await search({
    q: query,
    limit: 20,
    sort: "newlyListed",
    filter:
      "buyingOptions:{AUCTION},itemLocationCountry:GB,priceCurrency:GBP",
  });

  const MIN_DISCOUNT = 0.35;
  const MAX_BID_FACTOR = 0.70;

  const results = (live.itemSummaries || [])
    .map(item => {
      const livePrice = parseFloat(item.price?.value || 0);
      const discount = 1 - livePrice / avgSold;
      const maxBid = avgSold * MAX_BID_FACTOR;

      return {
        title: item.title,
        livePrice,
        avgSold,
        discount,
        maxBid: Math.max(0, maxBid).toFixed(0),
        url: item.itemWebUrl,
        image: item.image?.imageUrl,
      };
    })
    .filter(
      x =>
        x.discount >= MIN_DISCOUNT &&
        x.livePrice <= parseFloat(x.maxBid)
    )
    .sort((a, b) => b.discount - a.discount);

  return Response.json({ results });
}