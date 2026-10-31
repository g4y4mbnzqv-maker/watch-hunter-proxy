import { getComparables, mapPool, searchListings } from "./ebay";
import { POPULAR } from "./brands";
import { pruneHistory, recordScan } from "./priceIndex";
import { pruneComps } from "./compsStore";

// A scan never waits longer than this for the price index to save
const RECORD_TIMEOUT_MS = 2_500;
// Brands harvested at once
const HARVEST_CONCURRENCY = 3;
// Stop starting new brands after this long, to finish inside the function's
// time limit
const HARVEST_BUDGET_MS = 45_000;

// Records a scan for the price index without ever failing or slowing the
// scan itself
export async function recordScanQuietly(listings, options) {
  try {
    await Promise.race([
      recordScan(listings, options),
      new Promise((resolve) => setTimeout(resolve, RECORD_TIMEOUT_MS)),
    ]);
  } catch (err) {
    console.error("Price index couldn't save this scan:", err.message);
  }
}

// The daily run: scans each popular brand's auctions and records the
// prices. Auctions only, since their models' Buy It Now prices are what the
// index tracks; this keeps the run to roughly one scan per brand.
export async function harvest({ brands = POPULAR, startedAt = Date.now() } = {}) {
  const report = [];

  await mapPool(brands, HARVEST_CONCURRENCY, async (brand) => {
    if (Date.now() - startedAt > HARVEST_BUDGET_MS) {
      report.push({ brand, skipped: "out of time" });
      return;
    }
    try {
      const { items } = await searchListings(brand, { types: ["AUCTION"] });
      let limitReached = false;
      const comps = await getComparables(brand, items, {
        onLimit: () => {
          limitReached = true;
        },
      });
      const listings = items.map((item) => ({ ...item, comps: comps[item.itemId] ?? null }));
      const saved = await recordScan(listings, { brand });
      report.push({ brand, listings: items.length, ...saved, limitReached });
    } catch (err) {
      report.push({ brand, error: err.message, limitReached: Boolean(err.limitReached) });
    }
  });

  await pruneHistory();
  await pruneComps();
  return report;
}
