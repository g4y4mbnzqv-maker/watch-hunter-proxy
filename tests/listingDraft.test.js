import { describe, expect, it } from "vitest";
import { draftDescription, draftPrices, draftTitle } from "@/lib/listingDraft";
import { DEFAULT_SETTINGS } from "@/lib/profit";

const deal = {
  title: "L@@K!! Seiko SKX007 automatic divers 42mm jubilee RARE",
  brand: "Seiko",
  boughtFor: 120,
  askingMedian: 260,
  estimate: 221,
};

describe("listing drafts", () => {
  it("cleans the title and keeps it within eBay's 80 characters", () => {
    expect(draftTitle(deal)).toBe("Seiko SKX007 automatic divers 42mm jubilee");
    expect(draftTitle({ ...deal, title: "Turtle diver watch 44mm" })).toBe("Seiko Turtle diver watch 44mm");
    expect(draftTitle({ ...deal, title: "a ".repeat(60) }).length).toBeLessThanOrEqual(80);
  });

  it("suggests prices ending in 9, never below the estimate or break-even", () => {
    expect(draftPrices(deal, DEFAULT_SETTINGS)).toEqual({ ebay: 259, lowestOffer: 221, vinted: 249 });
    expect(draftPrices({ ...deal, askingMedian: null, estimate: null }, DEFAULT_SETTINGS)).toBeNull();
  });

  it("fills in what the title says and leaves gaps for the rest", () => {
    const text = draftDescription(deal);
    expect(text).toContain("Reference: SKX007");
    expect(text).toContain("Case size: 42mm");
    expect(text).toContain("Condition: [");
    expect(text).toContain("Special Delivery");
    expect(draftDescription(deal, { platform: "vinted" })).not.toContain("Special Delivery");
  });
});
