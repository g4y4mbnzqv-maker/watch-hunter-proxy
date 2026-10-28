import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getComparables, getUsage, searchAuctions } from "@/lib/ebay";

const listing = (title, price) => ({
  title,
  price: { value: String(price) },
  itemLocation: { country: "GB" },
});

// A fake eBay: answers the token request, then whatever the test supplies
function fakeEbay(respond) {
  const searches = [];
  vi.stubGlobal("fetch", async (input) => {
    const url = new URL(String(input));
    if (url.pathname.includes("oauth2")) {
      return Response.json({ access_token: "token", expires_in: 7200 });
    }
    searches.push(url);
    return Response.json(respond(url));
  });
  return searches;
}

beforeAll(() => {
  process.env.EBAY_CLIENT_ID = "id";
  process.env.EBAY_CLIENT_SECRET = "secret";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getComparables", () => {
  it("prices used auctions from used listings and leaves replicas out", async () => {
    const searches = fakeEbay((url) => ({
      itemSummaries: url.searchParams.get("filter").includes("conditions:{USED}")
        ? [
            listing("Seiko SKX007 used", 250),
            listing("Seiko SKX007 used", 270),
            listing("Seiko SKX007 used", 290),
            listing("SKX007 homage Rolex", 40),
          ]
        : [],
    }));

    const comps = await getComparables("seiko", [
      { itemId: "a", modelRef: "SKX007", conditionGroup: "USED" },
    ]);

    expect(comps.a).toEqual({ median: 270, low: 250, high: 290, count: 3, condition: "USED" });
    expect(searches[0].searchParams.get("filter")).toContain("itemLocationCountry:GB");
  });

  it("falls back to any condition and shares one lookup across variants", async () => {
    const searches = fakeEbay((url) => {
      const filter = url.searchParams.get("filter");
      if (filter.includes("conditions:{NEW}")) return { itemSummaries: [listing("Seiko SRPD55K1 new", 200)] };
      return {
        itemSummaries: [
          listing("Seiko SRPD55K1", 180),
          listing("Seiko SRPD55J1", 210),
          listing("Seiko SRPD55", 190),
        ],
      };
    });

    const comps = await getComparables("seiko", [
      { itemId: "b", modelRef: "SRPD55K1", conditionGroup: "NEW" },
      { itemId: "c", modelRef: "SRPD55J1", conditionGroup: "NEW" },
      { itemId: "d", modelRef: null, conditionGroup: "USED" },
    ]);

    expect(comps.b).toMatchObject({ median: 190, count: 3, condition: null });
    expect(comps.c).toEqual(comps.b);
    expect(comps.d).toBeUndefined();
    // One search with the condition, one without
    expect(searches).toHaveLength(2);
  });
});

describe("getUsage", () => {
  it("reports the tightest Browse API limit and ignores other APIs", async () => {
    fakeEbay(() => ({
      rateLimits: [
        {
          apiName: "Browse",
          resources: [
            { name: "buy.browse", rates: [{ limit: 5000, remaining: 4188, reset: "2026-10-29T07:00:00.000Z" }] },
            { name: "buy.browse.item.bulk", rates: [{ limit: 5000, remaining: 5000 }] },
          ],
        },
        { apiName: "Feed", resources: [{ name: "buy.feed", rates: [{ limit: 100, remaining: 1 }] }] },
      ],
    }));

    expect(await getUsage()).toEqual({
      limit: 5000,
      remaining: 4188,
      used: 812,
      reset: "2026-10-29T07:00:00.000Z",
    });
  });
});

describe("searchAuctions", () => {
  const auction = (id, title, country = "GB") => ({
    itemId: id,
    title,
    currentBidPrice: { value: "50" },
    itemEndDate: new Date(Date.now() + 3_600_000).toISOString(),
    itemLocation: { country },
  });

  it("says what happened to each auction eBay returned", async () => {
    fakeEbay(() => ({
      total: 4,
      itemSummaries: [
        auction("1", "Christopher Ward C60 Trident"),
        auction("2", "Rolex Submariner homage"),
        auction("3", "Christopher Ward strap only"),
        auction("4", "Christopher Ward C65", "DE"),
      ],
    }));

    const { items, stats } = await searchAuctions("Christopher Ward Test");

    expect(items.map((item) => item.itemId)).toEqual(["1"]);
    expect(stats).toEqual({
      auctionsOnEbay: 4,
      checked: 4,
      outsideUk: 1,
      replicas: 1,
      junk: 1,
      shown: 1,
      buyItNowOnEbay: null,
    });
  });

  it("counts Buy It Now listings when there are no auctions", async () => {
    const searches = fakeEbay((url) =>
      url.searchParams.get("filter").includes("FIXED_PRICE")
        ? { total: 37, itemSummaries: [] }
        : { total: 0 }
    );

    const { items, stats } = await searchAuctions("Studio Underdog Test");

    expect(items).toEqual([]);
    expect(stats).toMatchObject({ auctionsOnEbay: 0, shown: 0, buyItNowOnEbay: 37 });
    expect(searches[1].searchParams.get("filter")).toContain("itemLocationCountry:GB");
  });
});
