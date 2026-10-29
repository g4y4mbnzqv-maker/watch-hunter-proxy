import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { harvest } from "@/lib/harvest";
import { setTestDatabase } from "@/lib/priceIndex";

let pg;
beforeAll(() => {
  process.env.EBAY_CLIENT_ID = "id";
  process.env.EBAY_CLIENT_SECRET = "secret";
});
beforeEach(() => {
  pg = new PGlite();
  setTestDatabase(async (text, params) => (await pg.query(text, params)).rows);
});
afterEach(() => vi.unstubAllGlobals());

it("scans each brand's auctions and records prices, carrying on past a failing brand", async () => {
  const soon = new Date(Date.now() + 20 * 60_000).toISOString();
  const listing = (title, price) => ({ title, price: { value: String(price) }, itemLocation: { country: "GB" } });
  const searched = [];

  vi.stubGlobal("fetch", async (input) => {
    const url = new URL(String(input));
    if (url.pathname.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 7200 });
    if (url.pathname.includes("taxonomy")) return new Response("", { status: 404 });
    const q = url.searchParams.get("q");
    const filter = url.searchParams.get("filter");
    searched.push(`${q} | ${filter.split(",")[0]}`);
    if (q === "broken") return new Response("boom", { status: 500 });
    if (filter.includes("AUCTION")) {
      return Response.json({
        total: 1,
        itemSummaries: [
          {
            itemId: `${q}-1`,
            title: "Seiko SKX007 diver",
            currentBidPrice: { value: "150" },
            bidCount: 4,
            buyingOptions: ["AUCTION"],
            itemEndDate: soon,
            itemLocation: { country: "GB" },
          },
        ],
      });
    }
    return Response.json({ itemSummaries: [listing("Seiko SKX007", 280), listing("Seiko SKX007", 300), listing("SKX007 Seiko", 320)] });
  });

  const report = await harvest({ brands: ["seiko", "broken"] });

  expect(report.find((row) => row.brand === "seiko")).toMatchObject({ listings: 1, models: 1, closes: 1 });
  expect(report.find((row) => row.brand === "broken").error).toMatch(/500/);
  // Auctions only, so no Buy It Now listing search per brand
  expect(searched.filter((line) => line.endsWith("{FIXED_PRICE}") && !line.includes("SKX007"))).toEqual([]);

  const snapshot = (await pg.query("SELECT model_key, median FROM price_snapshots")).rows;
  expect(snapshot).toEqual([{ model_key: "ref:SKX007", median: 300 }]);
  const closes = (await pg.query("SELECT price FROM auction_closes")).rows;
  expect(closes).toEqual([{ price: 150 }]);
});
