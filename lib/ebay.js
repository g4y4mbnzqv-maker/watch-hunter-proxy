export async function searchAuctions(brand) {
  const endpoint =
    "https://svcs.ebay.com/services/search/FindingService/v1";

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

  const url = `${endpoint}?${params.toString()}`;

  const res = await fetch(url);

  const text = await res.text();

  if (!res.ok) {
    return {
      error: true,
      status: res.status,
      body: text,
    };
  }

  const data = JSON.parse(text);

  const items =
    data.findItemsAdvancedResponse?.[0]?.searchResult?.[0]?.item || [];

  return {
    error: false,
    items,
    raw: data,
  };
}