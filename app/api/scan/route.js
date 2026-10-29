import { searchListings, getComparables, EbayError } from "@/lib/ebay";
import { recordScanQuietly } from "@/lib/harvest";
import { pickupFor } from "@/lib/postcode";

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
  // Bike Hunter: only listings collectable this close to a postcode
  const pickup = pickupFor(searchParams.get("postcode"), searchParams.get("miles"));

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
    const { items: listings, stats } = await searchListings(brand, { includeJunk, types, pickup });
    let limitReached = false;
    const comps = await getComparables(brand, listings, {
      onLimit: () => {
        limitReached = true;
      },
    });

    const results = listings.map((item) => ({
      ...item,
      comps: comps[item.itemId] ?? null,
    }));

    // Adds this scan's prices to the price index, when there is a database
    await recordScanQuietly(results, { brand });

    return Response.json({
      brand,
      count: results.length,
      stats,
      // Some resale lookups were refused, so some cards lack an estimate
      limitReached,
      results,
    });
  } catch (err) {
    console.error(err);

    return Response.json(
      { error: true, message: err.message, limitReached: Boolean(err.limitReached) },
      { status: err instanceof EbayError ? err.status : 500 }
    );
  }
}
