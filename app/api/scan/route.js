import { searchListings, getComparables, EbayError } from "@/lib/ebay";
import { recordScanQuietly } from "@/lib/harvest";
import { isGem } from "@/lib/gems";
import { withAuctionResults } from "@/lib/priceIndex";

const LISTING_TYPES = ["AUCTION", "BUY_IT_NOW"];

export const dynamic = "force-dynamic";
// A scan with many resale lookups can take longer than the default limit
export const maxDuration = 60;

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

  // eBay turns away very long searches
  if (brand.length > 100) {
    return Response.json({ error: true, message: "Keep the search under 100 characters" }, { status: 400 });
  }

  if (!brand) {
    return Response.json(
      { error: true, message: "Enter a brand to search" },
      { status: 400 }
    );
  }

  try {
    // Hidden gems (unbranded cheap listings, judged by eye) and wanted-list
    // searches (compared with your own price) need no resale lookups, which
    // would cost an eBay call per model, and add nothing to the price index
    const gems = searchParams.get("gems") === "1";
    if (gems || searchParams.get("estimates") === "0") {
      const { items, stats } = await searchListings(brand, { includeJunk, types });
      const results = items.filter((item) => !gems || isGem(item)).map((item) => ({ ...item, comps: null }));
      return Response.json({ brand, count: results.length, stats, limitReached: false, results });
    }

    const { items: listings, stats } = await searchListings(brand, { includeJunk, types });
    let limitReached = false;
    const comps = await getComparables(brand, listings, {
      onLimit: () => {
        limitReached = true;
      },
    });

    // Recent auction results for the same models, where the price index
    // has enough of them
    const results = await withAuctionResults(
      listings.map((item) => ({
        ...item,
        comps: comps[item.itemId] ?? null,
      }))
    );

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
