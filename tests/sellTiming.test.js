import { describe, expect, it } from "vitest";
import { sellingTimes } from "@/lib/sellTiming";

describe("best time to sell", () => {
  it("waits for 30 results", () => {
    expect(sellingTimes([{ model: "a", price: 100, endsAt: "2026-11-01T19:00:00Z" }])).toMatchObject({ ready: false, count: 0 });
  });

  it("compares each result with its model's usual price, by UK day and time", () => {
    const rows = [];
    // Sunday 1 Nov 2026, 7pm UK (GMT): 20% above usual; Tuesday mornings at usual
    for (let i = 0; i < 12; i++) rows.push({ model: "skx", price: 120, endsAt: "2026-11-01T19:00:00Z" });
    for (let i = 0; i < 12; i++) rows.push({ model: "skx", price: 100, endsAt: "2026-11-03T09:00:00Z" });
    for (let i = 0; i < 10; i++) rows.push({ model: "prx", price: 300, endsAt: "2026-11-03T09:00:00Z" });
    const timing = sellingTimes(rows);
    expect(timing.ready).toBe(true);
    expect(timing.best.day.label).toBe("Sunday");
    expect(timing.best.time.key).toBe("evening");
    expect(timing.days.find((d) => d.key === "Sun").percent).toBe(9);
    expect(timing.days.find((d) => d.key === "Wed").percent).toBeNull();
  });
});
