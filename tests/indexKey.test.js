import { describe, expect, it } from "vitest";
import { trendFor, trendMap } from "@/lib/indexKey";

describe("price trends on cards", () => {
  const trends = trendMap([
    { modelKey: "ref:SRPD55", condition: "USED", change: { since: "2026-10-01", percent: 6.2 } },
    { modelKey: "ref:SRPD55", condition: "NEW", change: { since: "2026-10-01", percent: -3 } },
    { modelKey: "name:Seiko Turtle", condition: "ANY", change: { since: "2026-10-01", percent: 1.5 } },
    { modelKey: "ref:SKX007", condition: "USED", change: null },
  ]);

  it("finds the change for the listing's model and condition", () => {
    expect(trendFor({ modelRef: "SRPD55K1", conditionGroup: "NEW" }, trends).percent).toBe(-3);
    expect(trendFor({ modelRef: "SRPD55K1", conditionGroup: "USED" }, trends).percent).toBe(6.2);
  });

  it("falls back to any condition, and has nothing for untracked models", () => {
    expect(trendFor({ modelName: "Seiko Turtle", conditionGroup: "USED" }, trends).percent).toBe(1.5);
    expect(trendFor({ modelRef: "SKX007", conditionGroup: "USED" }, trends)).toBeNull();
    expect(trendFor({ title: "no model" }, trends)).toBeNull();
  });
});
