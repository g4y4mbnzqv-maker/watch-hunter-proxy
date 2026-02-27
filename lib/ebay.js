export async function searchAuctions(brand) {
  const endpoint =
    "https://svcs.ebay.com/services/search/FindingService/v1";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "X-EBAY-SOA-OPERATION-NAME": "findItemsAdvanced",
      "X-EBAY-SOA-SERVICE-VERSION": "1.13.0",
      "X-EBAY-SOA-SECURITY-APPNAME": process.env.EBAY_APP_ID,
      "X-EBAY-SOA-RESPONSE-DATA-FORMAT": "JSON",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      keywords: brand,
      itemFilter: [
        {
          name: "ListingType",
          value: ["Auction"],
        },
      ],
      paginationInput: {
        entriesPerPage: 20,
      },
    }),
  });

  const data = await res.json();

  const items =
    data.findItemsAdvancedResponse?.[0]?.searchResult?.[0]?.item || [];

  return items.map((item) => ({
    itemId: item.itemId?.[0],
    title: item.title?.[0],
    url: item.viewItemURL?.[0],
    image: item.galleryURL?.[0],
    currentBid: parseFloat(
      item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || 0
    ),
    bidCount: parseInt(
      item.sellingStatus?.[0]?.bidCount?.[0] || 0
    ),
    endTime: item.listingInfo?.[0]?.endTime?.[0],
  }));
}