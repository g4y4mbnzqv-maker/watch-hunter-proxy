import { describe, expect, it } from "vitest";
import { breakEven, stockReminders } from "@/lib/stock";
import { DEFAULT_SETTINGS } from "@/lib/profit";

const now = Date.parse("2026-11-30T12:00:00Z");
const deal = (overrides) => ({ id: "1", boughtOn: "2026-11-01", boughtFor: 120, soldFor: "", ...overrides });

describe("stock reminders", () => {
  it("nudges a watch bought over a week ago that isn't listed", () => {
    const [reminder] = stockReminders([deal({})], DEFAULT_SETTINGS, now);
    expect(reminder).toMatchObject({ kind: "unlisted", days: 29 });
    expect(stockReminders([deal({ boughtOn: "2026-11-27" })], DEFAULT_SETTINGS, now)).toEqual([]);
  });

  it("suggests 10% off a listing that hasn't sold in three weeks, ending in 9", () => {
    const [reminder] = stockReminders([deal({ listedOn: "2026-11-05", listedAt: 250 })], DEFAULT_SETTINGS, now);
    expect(reminder).toMatchObject({ kind: "stale", days: 25, suggestion: 219 });
  });

  it("never suggests going below break-even", () => {
    // £120 + £5 postage after 13% fees needs £144
    expect(breakEven(deal({}), DEFAULT_SETTINGS)).toBe(144);
    const [near] = stockReminders([deal({ listedOn: "2026-11-05", listedAt: 150 })], DEFAULT_SETTINGS, now);
    expect(near.suggestion).toBe(144);
    const [at] = stockReminders([deal({ listedOn: "2026-11-05", listedAt: 140 })], DEFAULT_SETTINGS, now);
    expect(at.suggestion).toBeNull();
  });

  it("ignores sold watches and fresh listings", () => {
    expect(stockReminders([deal({ soldFor: 200 }), deal({ listedOn: "2026-11-25", listedAt: 200 })], DEFAULT_SETTINGS, now)).toEqual([]);
  });
});
