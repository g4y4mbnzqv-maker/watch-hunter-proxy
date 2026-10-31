import { EbayError } from "@/lib/ebay";
import { MAX_TITLES, checkPrices } from "@/lib/priceCheck";

export const dynamic = "force-dynamic";

// Current asking prices for watch titles: { titles: [...] } in, { prices:
// [...] } out, one per title
export async function POST(req) {
  let titles;
  try {
    ({ titles } = await req.json());
  } catch {
    return Response.json({ error: true, message: "Send JSON" }, { status: 400 });
  }
  if (!Array.isArray(titles) || !titles.length || titles.length > MAX_TITLES || titles.some((title) => typeof title !== "string")) {
    return Response.json({ error: true, message: `Send 1 to ${MAX_TITLES} titles` }, { status: 400 });
  }
  try {
    return Response.json({ prices: await checkPrices(titles) });
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: true, message: err.message, limitReached: Boolean(err.limitReached) },
      { status: err instanceof EbayError ? err.status : 500 }
    );
  }
}
