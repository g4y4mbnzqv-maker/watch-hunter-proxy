export async function searchAuctions(brand) {
  const endpoint = "https://svcs.ebay.com/services/search/FindingService/v1";

  const params = new URLSearchParams({
    "OPERATION-NAME": "findItemsAdvanced",
    "SERVICE-VERSION": "1.13.0",
    "SECURITY-APPNAME": process.env.EBAY_APP_ID,
    "RESPONSE-DATA-FORMAT": "JSON",
    "REST-PAYLOAD": "",
    "keywords": brand,
    "itemFilter(0).name": "ListingType",
    "itemFilter(0).value": "Auction",
    "paginationInput.entriesPerPage": "20",
    "GLOBAL-ID": "EBAY-GB",
  });

  const res = await fetch(`${endpoint}?${params.toString()}`);

  if (!res.ok) {
    throw new Error("eBay Finding API error");
  }

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