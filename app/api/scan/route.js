import { search } from "../../../lib/ebay";

export const dynamic = "force-dynamic";

function avg(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);

  const brand = searchParams.get("brand") || "seiko";
  const model = searchParams.get("model") || "6309";

  const query = `${brand} ${model}`;

  const sold = await search({
    q: query,
    limit: 20,
    filter: "soldItems:true,itemLocationCountry:GB",
  });

  const soldPrices = sold.itemSummaries
    ?.map(i => parseFloat(i.price?.value || 0))
    .filter(Boolean);

  if (!soldPrices || soldPrices.length < 5) {
    return Response.json({ error: "Not enough sold data" });
  }

  const avgSold = avg(soldPrices);

  const live = await search({
    q: query,
    limit: 15,
    sort: "newlyListed",
    filter:
      "buyingOptions:{AUCTION},itemLocationCountry:GB,priceCurrency:GBP",
  });

  const results = live.itemSummaries?.map(item => {
    const livePrice = parseFloat(item.price?.value || 0);
    const discount = 1 - livePrice / avgSold;

    return {
      title: item.title,
      brand,
      model,
      livePrice,
      avgSold,
      discount,
      maxBid: (avgSold * 0.70).toFixed(0),
      url: item.itemWebUrl,
      image: item.image?.imageUrl,
    };
  });

  return Response.json({ results });
}