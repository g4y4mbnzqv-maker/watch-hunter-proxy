export async function searchAuctions(brand) {
  const endpoint = "https://svcs.ebay.com/services/search/FindingService/v1";

  const res = await fetch(
    `${endpoint}?OPERATION-NAME=findItemsByKeywords&SERVICE-VERSION=1.13.0&SECURITY-APPNAME=${process.env.EBAY_APP_ID}&RESPONSE-DATA-FORMAT=JSON&REST-PAYLOAD&keywords=${brand}`
  );

  const data = await res.json();

  return {
    raw: data
  };
}