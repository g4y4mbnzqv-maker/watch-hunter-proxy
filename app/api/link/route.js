import { EbayError, getItemByNumber } from "@/lib/ebay";
import { isEbayUrl, itemNumber, linkFromText, resolveItemNumber } from "@/lib/ebayLink";
import { brandFromTitle } from "@/lib/brands";
import { checkPrices } from "@/lib/priceCheck";

export const dynamic = "force-dynamic";
// A resale lookup can take a while on a cold cache
export const maxDuration = 60;

// Shared text is short; anything longer isn't a link
const MAX_TEXT = 2_000;

// A listing from an eBay link or item number, for adding a watch you bought:
// { found: true, item, comps } when eBay still returns it, else { found:
// false, itemNumber, url } so the watch can still be added by hand
export async function GET(req) {
  const text = new URL(req.url).searchParams.get("url") || "";
  const link = text.length <= MAX_TEXT ? linkFromText(text) : null;
  if (!link || !(itemNumber(link) || isEbayUrl(link))) {
    return Response.json({ error: true, message: "That doesn't look like an eBay link." }, { status: 400 });
  }

  try {
    const number = itemNumber(link) ?? (await resolveItemNumber(link));
    if (!number) {
      return Response.json(
        { error: true, message: "Couldn't find the listing behind that link. Try the full address from eBay in a browser." },
        { status: 404 }
      );
    }

    const url = `https://www.ebay.co.uk/itm/${number}`;
    const listing = await getItemByNumber(number);
    if (!listing) return Response.json({ found: false, itemNumber: number, url });

    const item = { ...listing, brand: brandFromTitle(listing.title) ?? "" };
    // Today's asking prices are a bonus; the watch is still added without them
    let comps = null;
    try {
      [comps] = await checkPrices([listing.title]);
    } catch (err) {
      console.error(err);
    }
    return Response.json({ found: true, item, comps });
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: true, message: err.message, limitReached: Boolean(err.limitReached) },
      { status: err instanceof EbayError ? err.status : 500 }
    );
  }
}
