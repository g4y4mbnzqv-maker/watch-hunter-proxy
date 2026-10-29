import { describe, expect, it } from "vitest";
import { dealFees, dealProfit, daysToSell, saleRatio, summarise, toCsv } from "@/lib/dealLog";
import { DEFAULT_SETTINGS } from "@/lib/profit";

const settings = DEFAULT_SETTINGS;
const deal = (overrides) => ({
  id: "1", title: "Seiko SKX007", brand: "Seiko", boughtOn: "2026-10-01", boughtFor: 120,
  askingMedian: 300, estimate: 255, soldOn: null, soldFor: null, fees: null, postageOut: 5, platform: "ebay",
  ...overrides,
});

describe("profit on a deal", () => {
  it("takes the eBay fee from Settings when none was entered", () => {
    const sold = deal({ soldFor: 240, soldOn: "2026-10-15" });
    expect(dealFees(sold, settings)).toBe(31.2);
    expect(dealProfit(sold, settings)).toBe(83.8);
    expect(daysToSell(sold)).toBe(14);
  });

  it("charges no fees on Vinted and uses entered fees as given", () => {
    expect(dealProfit(deal({ soldFor: 240, platform: "vinted" }), settings)).toBe(115);
    expect(dealProfit(deal({ soldFor: 240, fees: 20 }), settings)).toBe(95);
  });

  it("has no profit while unsold", () => {
    expect(dealProfit(deal({}), settings)).toBeNull();
  });
});

describe("summarise", () => {
  it("totals sold watches and stock", () => {
    const summary = summarise(
      [deal({ soldFor: 240, soldOn: "2026-10-15" }), deal({ id: "2", soldFor: 200, platform: "vinted", soldOn: "2026-10-05" }), deal({ id: "3", boughtFor: 60 })],
      settings
    );
    expect(summary).toEqual({ bought: 3, sold: 2, profit: 158.8, revenue: 440, inStock: 1, stockCost: 60, medianDays: 9 });
  });
});

describe("saleRatio", () => {
  it("needs three sales before suggesting a figure", () => {
    const two = [deal({ soldFor: 240 }), deal({ soldFor: 210 })];
    expect(saleRatio(two)).toEqual({ count: 2, percent: null, byBrand: [] });
  });

  it("gives the median sale as a share of the asking median, overall and by brand", () => {
    const deals = [
      deal({ soldFor: 240 }), // 80%
      deal({ soldFor: 210 }), // 70%
      deal({ soldFor: 270 }), // 90%
      deal({ brand: "Omega", soldFor: 1500, askingMedian: 2000 }), // 75%
      deal({ soldFor: null }),
      deal({ soldFor: 100, askingMedian: null }),
    ];
    expect(saleRatio(deals)).toEqual({ count: 4, percent: 78, byBrand: [{ brand: "Seiko", percent: 80, count: 3 }] });
  });
});

describe("toCsv", () => {
  it("quotes cells with commas and fills in fees and profit", () => {
    const csv = toCsv([deal({ title: 'Seiko "Turtle", boxed', soldFor: 240, soldOn: "2026-10-15" })], settings);
    const [header, row] = csv.split("\n");
    expect(header).toContain("Bought for (incl. postage)");
    expect(row).toMatch(/^"Seiko ""Turtle"", boxed",Seiko,2026-10-01,120,300,255,2026-10-15,240,eBay,31.2,5,83.8,$/);
  });
});

describe("brandFromTitle", async () => {
  const { brandFromTitle } = await import("@/lib/brands");
  it("finds the longest brand named in a title", () => {
    expect(brandFromTitle("Grand Seiko SBGA211 Snowflake")).toBe("Grand Seiko");
    expect(brandFromTitle("Vintage TAG HEUER 2000 diver")).toBe("TAG Heuer");
    expect(brandFromTitle("Gents automatic watch")).toBeNull();
  });
});
