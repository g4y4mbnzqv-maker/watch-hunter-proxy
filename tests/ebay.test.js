import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getComparables, getUsage, searchListings, withoutOutliers } from "@/lib/ebay";

const listing = (title, price) => ({
  title,
  price: { value: String(price) },
  itemLocation: { country: "GB" },
});

// A fake eBay: answers the token request, turns down the category lookup
// (tests/category.test.js covers that), then answers whatever the test supplies
function fakeEbay(respond) {
  const searches = [];
  vi.stubGlobal("fetch", async (input) => {
    const url = new URL(String(input));
    if (url.pathname.includes("oauth2")) {
      return Response.json({ access_token: "token", expires_in: 7200 });
    }
    if (url.pathname.includes("taxonomy")) {
      return new Response("not here", { status: 404 });
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

    expect(comps.a).toEqual({ median: 270, low: 250, high: 290, count: 3, ignored: 0, condition: "USED", matchedBy: "reference" });
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

describe("searchListings", () => {
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

    const { items, stats } = await searchListings("Christopher Ward Test");

    expect(items.map((item) => item.itemId)).toEqual(["1"]);
    expect(stats).toEqual({
      auctionsOnEbay: 4,
      checked: 4,
      notWatches: 0,
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

    const { items, stats } = await searchListings("Studio Underdog Test");

    expect(items).toEqual([]);
    expect(stats).toMatchObject({ auctionsOnEbay: 0, shown: 0, buyItNowOnEbay: 37 });
    expect(searches[1].searchParams.get("filter")).toContain("itemLocationCountry:GB");
  });
});

describe("withoutOutliers", () => {
  it("ignores prices far above or below the median", () => {
    expect(withoutOutliers([150, 180, 200, 210, 230, 2400, 4500])).toEqual([150, 180, 200, 210, 230]);
    expect(withoutOutliers([20, 180, 200, 210])).toEqual([180, 200, 210]);
  });

  it("leaves tight or tiny lists alone", () => {
    expect(withoutOutliers([180, 200, 260])).toEqual([180, 200, 260]);
    expect(withoutOutliers([100, 900])).toEqual([100, 900]);
  });
});

describe("Buy It Now and photos", () => {
  const endTime = new Date(Date.now() + 3_600_000).toISOString();

  it("searches both listing types without repeating a listing", async () => {
    const searches = fakeEbay((url) => {
      const filter = url.searchParams.get("filter");
      if (filter.includes("FIXED_PRICE")) {
        expect(url.searchParams.get("sort")).toBe("newlyListed");
        return {
          total: 12,
          itemSummaries: [
            {
              itemId: "bin",
              title: "Seiko SKX007 boxed",
              price: { value: "180" },
              buyingOptions: ["FIXED_PRICE", "BEST_OFFER"],
              itemLocation: { country: "GB" },
              image: { imageUrl: "https://i.ebayimg.com/images/g/a/s-l225.jpg" },
              additionalImages: [
                { imageUrl: "https://i.ebayimg.com/images/g/b/s-l225.jpg" },
                { imageUrl: "https://i.ebayimg.com/images/g/c/s-l225.jpg" },
              ],
            },
            // Offers bidding too, so it also comes back from the auction search
            {
              itemId: "both",
              title: "Seiko SKX009",
              currentBidPrice: { value: "90" },
              price: { value: "250" },
              buyingOptions: ["AUCTION", "FIXED_PRICE"],
              itemEndDate: endTime,
              itemLocation: { country: "GB" },
            },
          ],
        };
      }
      return {
        total: 1,
        itemSummaries: [
          {
            itemId: "both",
            title: "Seiko SKX009",
            currentBidPrice: { value: "90" },
            price: { value: "250" },
            buyingOptions: ["AUCTION", "FIXED_PRICE"],
            itemEndDate: endTime,
            itemLocation: { country: "GB" },
          },
        ],
      };
    });

    const { items, stats } = await searchListings("seiko both types", { types: ["AUCTION", "BUY_IT_NOW"] });

    expect(searches).toHaveLength(2);
    expect(items.map((item) => item.itemId)).toEqual(["both", "bin"]);
    expect(stats).toMatchObject({ auctionsOnEbay: 1, buyItNowOnEbay: 12, shown: 2 });

    const [both, bin] = items;
    expect(both).toMatchObject({ listingType: "AUCTION", currentBid: 90, endTime });
    expect(bin).toMatchObject({ listingType: "BUY_IT_NOW", bestOffer: true, currentBid: 180, endTime: null });
    expect(bin.images).toHaveLength(3);
  });

  it("prices a listing with no reference from others with the same model name", async () => {
    const searches = fakeEbay((url) => ({
      itemSummaries: url.searchParams.get("filter").includes("FIXED_PRICE")
        ? [
            listing("Seiko Prospex Turtle black", 280),
            listing("Seiko Turtle blue dial", 300),
            listing("SEIKO TURTLE automatic", 320),
            listing("Seiko SRPE93 Turtle", 400),
            listing("Seiko Samurai", 350),
          ]
        : [],
    }));

    const comps = await getComparables("seiko", [
      { itemId: "t", modelRef: null, modelName: "Seiko Turtle", conditionGroup: null },
    ]);

    expect(searches[0].searchParams.get("q")).toBe("Seiko Turtle");
    // The SRPE93 has its own reference, and the Samurai is another model
    expect(comps.t).toMatchObject({ median: 300, count: 3, matchedBy: "name" });
  });
});
