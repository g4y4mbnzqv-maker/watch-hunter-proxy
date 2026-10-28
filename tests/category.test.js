import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getWatchCategoryId, isWatchListing, searchAuctions } from "@/lib/ebay";

beforeAll(() => {
  process.env.EBAY_CLIENT_ID = "id";
  process.env.EBAY_CLIENT_SECRET = "secret";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isWatchListing", () => {
  it("drops listings filed under no watch category", () => {
    expect(
      isWatchListing({
        title: "Vauxhall Omega B front brake discs",
        categories: [{ categoryName: "Vehicle Parts & Accessories" }, { categoryName: "Car Parts" }],
      })
    ).toBe(false);
  });

  it("keeps watches, and listings eBay gives no categories for", () => {
    expect(
      isWatchListing({
        categories: [
          { categoryName: "Jewellery & Watches" },
          { categoryName: "Watches, Parts & Accessories" },
          { categoryName: "Wristwatches" },
        ],
      })
    ).toBe(true);
    expect(isWatchListing({ title: "Omega Seamaster" })).toBe(true);
  });
});

describe("watch category", () => {
  it("finds Wristwatches through the Taxonomy API and searches only that category", async () => {
    const searches = [];
    vi.stubGlobal("fetch", async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 7200 });
      if (url.pathname.endsWith("get_default_category_tree_id")) {
        expect(url.searchParams.get("marketplace_id")).toBe("EBAY_GB");
        return Response.json({ categoryTreeId: "3" });
      }
      if (url.pathname.includes("get_category_suggestions")) {
        expect(url.pathname).toContain("/category_tree/3/");
        return Response.json({
          categorySuggestions: [
            { category: { categoryId: "14324", categoryName: "Watch Parts" } },
            { category: { categoryId: "31387", categoryName: "Wristwatches" } },
          ],
        });
      }
      searches.push(url);
      return Response.json({
        total: 2,
        itemSummaries: [
          {
            itemId: "w",
            title: "Omega Seamaster 300M",
            currentBidPrice: { value: "900" },
            itemEndDate: new Date(Date.now() + 3_600_000).toISOString(),
            itemLocation: { country: "GB" },
            categories: [{ categoryName: "Wristwatches" }],
          },
          {
            itemId: "car",
            title: "Vauxhall Omega wing mirror",
            currentBidPrice: { value: "20" },
            itemEndDate: new Date(Date.now() + 3_600_000).toISOString(),
            itemLocation: { country: "GB" },
            categories: [{ categoryName: "Car Parts" }],
          },
        ],
      });
    });

    expect(await getWatchCategoryId()).toBe("31387");

    const { items, stats } = await searchAuctions("omega category test");
    expect(searches[0].searchParams.get("category_ids")).toBe("31387");
    expect(items.map((item) => item.itemId)).toEqual(["w"]);
    expect(stats.notWatches).toBe(1);
  });
});
