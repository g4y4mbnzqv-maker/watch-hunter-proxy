import { describe, expect, it } from "vitest";
import { priceMovers, weeklyReview } from "@/lib/review";
import { DEFAULT_SETTINGS } from "@/lib/profit";

const now = Date.parse("2026-11-30T12:00:00Z");
const sold = (id, brand, boughtFor, soldFor, soldOn, boughtOn = "2026-11-01") => ({
  id, brand, boughtFor, soldFor, soldOn, boughtOn, platform: "vinted", postageOut: 0, fees: "",
});

describe("weekly review", () => {
  const deals = [
    sold("1", "Seiko", 100, 180, "2026-11-28"),
    sold("2", "Seiko", 100, 160, "2026-11-10"),
    sold("3", "Citizen", 80, 90, "2026-11-27"),
    sold("4", "Citizen", 80, 70, "2026-10-15", "2026-10-01"),
    { id: "5", brand: "Omega", boughtFor: 400, soldFor: "", boughtOn: "2026-11-26" },
  ];

  it("totals the last 7 and 30 days", () => {
    const review = weeklyReview(deals, DEFAULT_SETTINGS, { now });
    expect(review.week).toEqual({ sold: 2, profit: 90, bought: 1, spent: 400 });
    // Three were bought on 1 November, inside the 30 days
    expect(review.month).toEqual({ sold: 3, profit: 150, bought: 4, spent: 680 });
  });

  it("names the brands earning most and least per watch", () => {
    const review = weeklyReview(deals, DEFAULT_SETTINGS, { now });
    expect(review.best).toMatchObject({ brand: "Seiko", count: 2, average: 70 });
    expect(review.worst).toMatchObject({ brand: "Citizen", count: 2, average: 0 });
  });

  it("lists the biggest price moves, ignoring small ones", () => {
    const movers = priceMovers([
      { label: "SKX007", change: { percent: 12 } },
      { label: "SRPD55", change: { percent: 3 } },
      { label: "Turtle", change: { percent: -8 } },
      { label: "NY0040", change: null },
    ]);
    expect(movers.rising.map((m) => m.label)).toEqual(["SKX007"]);
    expect(movers.falling.map((m) => m.label)).toEqual(["Turtle"]);
  });
});
