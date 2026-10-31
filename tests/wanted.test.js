import { describe, expect, it } from "vitest";
import { MAX_WANTED, cleanWanted, matchesWanted } from "@/lib/wanted";

const now = Date.parse("2026-11-30T12:00:00Z");
const want = { id: "skx", query: "Seiko SKX007", maxPrice: 180 };

describe("wanted list", () => {
  it("keeps tidy, unique entries within the limit", () => {
    expect(cleanWanted([{ query: " Seiko SKX007 ", maxPrice: 180 }, { query: "seiko skx007", maxPrice: 150 }, { query: "", maxPrice: 50 }, { query: "Tudor", maxPrice: 0 }]))
      .toEqual([{ id: "seiko skx007", query: "Seiko SKX007", maxPrice: 180 }]);
    expect(cleanWanted(Array.from({ length: 30 }, (_, i) => ({ query: `Model ${i}`, maxPrice: 100 })))).toHaveLength(MAX_WANTED);
    expect(cleanWanted("nonsense")).toEqual([]);
  });

  it("matches Buy It Now at or under your price any time", () => {
    expect(matchesWanted({ listingType: "BUY_IT_NOW", totalCost: 175 }, want, now)).toBe(true);
    expect(matchesWanted({ listingType: "BUY_IT_NOW", totalCost: 185 }, want, now)).toBe(false);
  });

  it("matches auctions only in their last three hours", () => {
    const soon = new Date(now + 2 * 3_600_000).toISOString();
    const later = new Date(now + 20 * 3_600_000).toISOString();
    expect(matchesWanted({ listingType: "AUCTION", totalCost: 120, endTime: soon }, want, now)).toBe(true);
    expect(matchesWanted({ listingType: "AUCTION", totalCost: 120, endTime: later }, want, now)).toBe(false);
  });
});
