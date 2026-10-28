import { describe, expect, it } from "vitest";
import { analyse, DEFAULT_SETTINGS } from "@/lib/profit";

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

  it("treats unknown postage as free", () => {
    expect(analyse({ ...item, postage: null }, DEFAULT_SETTINGS).profit).toBe(62.9);
  });
});
