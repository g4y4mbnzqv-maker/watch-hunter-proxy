import { getAuctions, EbayError } from "@/lib/ebay";

export const dynamic = "force-dynamic";

// Keeps one refresh within a sensible number of eBay calls
const MAX_ITEMS = 50;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const ids = (searchParams.get("ids") || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!ids.length) {
    return Response.json({ items: [], missing: [] });
  }

  if (ids.length > MAX_ITEMS) {
    return Response.json(
      { error: true, message: `Refresh up to ${MAX_ITEMS} saved auctions at a time` },
      { status: 400 }
    );
  }

  try {
    return Response.json(await getAuctions(ids));
  } catch (err) {
    console.error(err);

    return Response.json(
      { error: true, message: err.message, limitReached: Boolean(err.limitReached) },
      { status: err instanceof EbayError ? err.status : 500 }
    );
  }
}
