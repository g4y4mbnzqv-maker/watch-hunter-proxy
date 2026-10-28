import { searchListings, getComparables, EbayError } from "@/lib/ebay";

const LISTING_TYPES = ["AUCTION", "BUY_IT_NOW"];

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const brand = (searchParams.get("brand") || "seiko").trim();
  const includeJunk = searchParams.get("includeJunk") === "1";
  // Which listings to search, such as "AUCTION,BUY_IT_NOW"; auctions alone
  // by default
  const types = (searchParams.get("types") || "AUCTION")
    .split(",")
    .filter((type) => LISTING_TYPES.includes(type));

  if (!types.length) {
    return Response.json(
      { error: true, message: "Choose auctions, Buy It Now or both" },
      { status: 400 }
    );
  }

  if (!brand) {
    return Response.json(
      { error: true, message: "Enter a brand to search" },
      { status: 400 }
    );
  }

  try {
    const { items: listings, stats } = await searchListings(brand, { includeJunk, types });
    const comps = await getComparables(brand, listings);

    const results = listings.map((item) => ({
      ...item,
      comps: comps[item.itemId] ?? null,
    }));

    return Response.json({
      brand,
      count: results.length,
      stats,
      results,
    });
  } catch (err) {
    console.error(err);

    return Response.json(
      { error: true, message: err.message },
      { status: err instanceof EbayError ? err.status : 500 }
    );
  }
}
