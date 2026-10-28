import { describe, expect, it } from "vitest";
import { conditionGrade } from "@/lib/condition";

const grade = (conditionId, condition, title = "Seiko SKX007") =>
  conditionGrade({ conditionId, condition, title });

describe("conditionGrade", () => {
  it("uses eBay's grade when the seller gave one", () => {
    expect(grade("1000", "New with tags")).toEqual({ grade: "new", from: "ebay" });
    expect(grade("2990", "Pre-owned - Excellent")).toEqual({ grade: "excellent", from: "ebay" });
    expect(grade("3010", "Pre-owned - Fair")).toEqual({ grade: "fair", from: "ebay" });
    expect(grade("1750", "New with defects").grade).toBe("fair");
  });

  it("reads the grade from eBay's wording when the ID doesn't give one", () => {
    expect(grade("3000", "Pre-owned - Good")).toEqual({ grade: "good", from: "ebay" });
  });

  it("falls back to the title for plain pre-owned listings", () => {
    expect(grade("3000", "Pre-owned", "Seiko SKX007 mint boxed")).toEqual({ grade: "excellent", from: "title" });
    expect(grade("3000", "Pre-owned", "Seiko SKX007 very good condition")).toEqual({ grade: "good", from: "title" });
  });

  it("leaves plain pre-owned listings ungraded when the title says nothing", () => {
    expect(grade("3000", "Pre-owned")).toEqual({ grade: "ungraded", from: null });
    expect(grade(null, null)).toEqual({ grade: "ungraded", from: null });
  });

  it("trusts eBay's grade over the title", () => {
    expect(grade("3010", "Pre-owned - Fair", "Seiko SKX007 mint").grade).toBe("fair");
  });
});
