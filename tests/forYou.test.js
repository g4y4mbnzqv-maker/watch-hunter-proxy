import { describe, expect, it } from "vitest";
import { MIN_PICKS, buildTaste, scoreFor } from "@/lib/forYou";

describe("For you", () => {
  const watchlist = {
    a: { itemId: "a", title: "Seiko SKX007 diver", totalCost: 150 },
    b: { itemId: "b", title: "Seiko Turtle SRP777", totalCost: 200 },
    c: { itemId: "c", title: "Citizen Promaster diver", totalCost: 120 },
  };
  const deals = [{ id: "d", title: "Seiko SKX009", brand: "Seiko", boughtFor: 160 }];

  it("learns brands, price and models, counting buys twice", () => {
    const taste = buildTaste({ watchlist, deals });
    expect(taste.count).toBe(4);
    expect(taste.brands).toEqual({ Seiko: 4, Citizen: 1 });
    expect(taste.price).toBe(160);
    expect(taste.models.has("SKX007")).toBe(true);
    expect(MIN_PICKS).toBe(5);
  });

  it("scores listings like your picks higher", () => {
    const taste = buildTaste({ watchlist, deals });
    const sameModel = scoreFor({ title: "Seiko SKX007 jubilee", totalCost: 170 }, taste);
    const sameBrand = scoreFor({ title: "Seiko 5 automatic", totalCost: 160 }, taste);
    const other = scoreFor({ title: "Omega Seamaster 300", totalCost: 2500 }, taste);
    expect(sameModel).toBeGreaterThan(sameBrand);
    expect(sameBrand).toBeGreaterThan(other);
    expect(other).toBeLessThan(0.05);
    expect(scoreFor({ title: "Seiko" }, buildTaste())).toBe(0);
  });
});
