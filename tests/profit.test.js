import { describe, expect, it } from "vitest";
import { analyse, DEFAULT_SETTINGS, roughEstimateReasons } from "@/lib/profit";

const item = { currentBid: 80, postage: 6, comps: { median: 200, count: 8 } };

describe("analyse", () => {
  it("works out resale, profit and the most to bid from comparables", () => {
    const result = analyse(item, DEFAULT_SETTINGS);

    // 85% of £200, less 13% fees and £5 postage out, less £86 cost
    expect(result.resale).toBe(170);
    expect(result.sellingFees).toBe(22.1);
    expect(result.profit).toBe(56.9);
    expect(result.roi).toBe(66);
    // £142.90 net, less £6 postage in and £30 target profit
    expect(result.maxBid).toBe(106);
    expect(result.status).toBe("deal");
    expect(result.resaleSource).toBe("comps");
  });

  it("uses a typed value over the comparables and says where it came from", () => {
    expect(analyse(item, DEFAULT_SETTINGS, { value: 120, source: "listing" })).toMatchObject({
      resale: 120,
      profit: 13.4,
      resaleSource: "listing",
      status: "thin",
    });
    expect(analyse(item, DEFAULT_SETTINGS, { value: 300, source: "model" }).resaleSource).toBe("model");
  });

  it("marks a listing with no estimate as unknown", () => {
    expect(analyse({ ...item, comps: null }, DEFAULT_SETTINGS)).toMatchObject({
      resale: null,
      profit: null,
      maxBid: null,
      status: "unknown",
    });
  });

  it("calls a loss a loss and never suggests a negative bid", () => {
    const result = analyse({ ...item, currentBid: 400 }, DEFAULT_SETTINGS);
    expect(result.status).toBe("loss");
    expect(result.maxBid).toBe(106);

    const tiny = analyse({ currentBid: 1, postage: 0, comps: { median: 10 } }, DEFAULT_SETTINGS);
    expect(tiny.maxBid).toBe(0);
  });

  it("keeps the bid limit within Maximum spend, postage included", () => {
    const pricey = { currentBid: 300, postage: 10, comps: { median: 1200, count: 8 } };
    const open = analyse(pricey, DEFAULT_SETTINGS);
    expect(open.maxBid).toBe(842);
    expect(open.budgetCapped).toBe(false);

    const capped = analyse(pricey, { ...DEFAULT_SETTINGS, maxBudget: 600 });
    expect(capped.maxBid).toBe(590);
    expect(capped.budgetCapped).toBe(true);
    // Profit is still worked out at the current price
    expect(capped.profit).toBe(open.profit);

    // A limit above the profit limit changes nothing
    expect(analyse(item, { ...DEFAULT_SETTINGS, maxBudget: 600 })).toMatchObject({ maxBid: 106, budgetCapped: false });
  });

  it("treats unknown postage as free", () => {
    expect(analyse({ ...item, postage: null }, DEFAULT_SETTINGS).profit).toBe(62.9);
  });
});

describe("rough estimates", () => {
  const comps = { median: 2000, low: 1500, high: 2500, count: 8 };
  const bamford = { title: "Casio G-Shock x Bamford GM-5600", currentBid: 120, postage: 5, comps };

  it("won't call a special edition a deal on an estimate alone", () => {
    const result = analyse(bamford, DEFAULT_SETTINGS);
    expect(result.status).toBe("check");
    expect(result.roughReasons).toEqual(["special or limited edition"]);
  });

  it("trusts your own value", () => {
    const result = analyse(bamford, DEFAULT_SETTINGS, { value: 400, source: "model" });
    expect(result.roughReasons).toEqual([]);
    expect(result.status).toBe("deal");
  });

  it("flags thin or widely spread comparables", () => {
    expect(roughEstimateReasons({ title: "Seiko SKX007", comps: { count: 3, low: 200, high: 260 } })).toEqual([
      "only 3 listings to go on",
    ]);
    expect(roughEstimateReasons({ title: "Seiko SKX007", comps: { count: 9, low: 100, high: 400 } })).toEqual([
      "asking prices vary a lot",
    ]);
    expect(roughEstimateReasons({ title: "Seiko SKX007", comps: { count: 9, low: 200, high: 300 } })).toEqual([]);
  });
});

describe("brand figures from your own sales", () => {
  const seiko = { title: "Seiko SKX007", currentBid: 80, postage: 6, comps: { median: 200, count: 8 } };
  const settings = { ...DEFAULT_SETTINGS, brandResalePercent: { Seiko: 70 } };

  it("uses your brand's figure where you have one", () => {
    const result = analyse(seiko, settings);
    expect(result.resale).toBe(140);
    expect(result.brandPercent).toEqual({ percent: 70, brand: "Seiko" });
  });

  it("uses the general figure for other brands and for your own values", () => {
    expect(analyse({ ...seiko, title: "Citizen NY0040" }, settings).resale).toBe(170);
    expect(analyse(seiko, settings, { value: 300, source: "listing" }).brandPercent).toBeNull();
  });
});

describe("Vinted profit", () => {
  it("leaves out eBay's fee and postage to the buyer", () => {
    // £170 resale, no fee, no postage out, less £86 cost
    expect(analyse(item, DEFAULT_SETTINGS).vintedProfit).toBe(84);
    expect(analyse(item, { ...DEFAULT_SETTINGS, vintedFeePercent: 5 }).vintedProfit).toBe(75.5);
  });
});
