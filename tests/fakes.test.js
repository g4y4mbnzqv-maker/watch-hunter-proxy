import { describe, expect, it } from "vitest";
import { isTooCheap, oftenFakedBrand } from "@/lib/fakes";
import { analyse, DEFAULT_SETTINGS } from "@/lib/profit";

const comps = { median: 4000, low: 3200, high: 4800, count: 8 };

describe("oftenFakedBrand", () => {
  it("names often-faked brands from the tag or the title", () => {
    expect(oftenFakedBrand({ brand: "Rolex", title: "Submariner" })).toBe("Rolex");
    expect(oftenFakedBrand({ title: "Omega Seamaster 300m" })).toBe("Omega");
    expect(oftenFakedBrand({ title: "Seiko SKX007" })).toBeNull();
  });
});

describe("isTooCheap", () => {
  it("flags Buy It Now prices under half the cheapest comparable", () => {
    expect(isTooCheap({ listingType: "BUY_IT_NOW", currentBid: 1500, postage: 0, comps })).toBe(true);
    expect(isTooCheap({ listingType: "BUY_IT_NOW", currentBid: 1700, postage: 0, comps })).toBe(false);
  });

  it("leaves auctions alone, since early bids are always low", () => {
    expect(isTooCheap({ listingType: "AUCTION", currentBid: 50, postage: 0, comps })).toBe(false);
  });

  it("makes a big profit a Check value rather than a Deal", () => {
    const result = analyse({ listingType: "BUY_IT_NOW", currentBid: 900, postage: 10, comps }, DEFAULT_SETTINGS);
    expect(result.tooCheap).toBe(true);
    expect(result.status).toBe("check");
  });
});

describe("Authenticity Guarantee", async () => {
  const { searchListings } = await import("@/lib/ebay");
  const { vi } = await import("vitest");
  it("is read from eBay's qualified programmes", async () => {
    process.env.EBAY_CLIENT_ID = "id";
    process.env.EBAY_CLIENT_SECRET = "secret";
    vi.stubGlobal("fetch", async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 7200 });
      if (url.pathname.includes("taxonomy")) return new Response("no", { status: 404 });
      return Response.json({
        total: 2,
        itemSummaries: ["1", "2"].map((id) => ({
          itemId: id,
          title: `Cartier Tank ${id}`,
          currentBidPrice: { value: "900" },
          itemEndDate: new Date(Date.now() + 3_600_000).toISOString(),
          itemLocation: { country: "GB" },
          qualifiedPrograms: id === "1" ? ["AUTHENTICITY_GUARANTEE"] : [],
        })),
      });
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { items } = await searchListings("Guarantee Test");
    expect(items.map((item) => item.authenticityGuarantee)).toEqual([true, false]);
    vi.unstubAllGlobals();
  });
});
