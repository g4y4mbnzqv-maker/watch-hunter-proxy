export async function searchAuctions(brand) {
  const url = new URL(
    "https://api.ebay.com/buy/browse/v1/item_summary/search"
  );

  url.searchParams.set("q", brand);
  url.searchParams.set("filter", "buyingOptions:{AUCTION}");
  url.searchParams.set("limit", "20");

  const res = await fetch(url.toString(), {
    headers: {
      "X-EBAY-C-ENDUSERCTX":
        "contextualLocation=country=GB",
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
      "X-EBAY-API-KEY": process.env.EBAY_APP_ID,
    },
  });

  const data = await res.json();

  const items = data.itemSummaries || [];

  return items.map((item) => ({
    itemId: item.itemId,
    title: item.title,
    url: item.itemWebUrl,
    image: item.image?.imageUrl,
    currentBid: item.currentBidPrice?.value || 0,
    bidCount: item.bidCount || 0,
    endTime: item.itemEndDate,
  }));
}