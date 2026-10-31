import { describe, expect, it } from "vitest";
import { platformReporting, salesTaxYears, taxYear, taxYearSummary } from "@/lib/tax";
import { DEFAULT_SETTINGS } from "@/lib/profit";

const sale = (soldOn, soldFor, platform = "ebay") => ({ id: soldOn + soldFor, soldOn, soldFor, boughtFor: soldFor - 50, platform, postageOut: 0, fees: 0 });

describe("tax figures", () => {
  it("puts dates in the right tax year, which starts on 6 April", () => {
    expect(taxYear("2026-04-05").label).toBe("2025/26");
    expect(taxYear("2026-04-06")).toEqual({ label: "2026/27", start: "2026-04-06", end: "2027-04-05" });
    expect(taxYear("2027-01-15").label).toBe("2026/27");
  });

  it("totals the current tax year against the £1,000 trading allowance", () => {
    const deals = [sale("2026-05-01", 600), sale("2026-10-01", 500), sale("2026-03-01", 900)];
    const summary = taxYearSummary(deals, DEFAULT_SETTINGS, new Date("2026-11-30T12:00:00Z"));
    expect(summary).toMatchObject({ sales: 2, takings: 1100, profit: 100, overAllowance: true });
    expect(summary.year.label).toBe("2026/27");
  });

  it("counts sales per site in the calendar year against the reporting thresholds", () => {
    const deals = [sale("2026-02-01", 1800, "ebay"), sale("2026-03-01", 100, "vinted"), sale("2025-12-01", 500, "vinted")];
    expect(platformReporting(deals, new Date("2026-11-30T12:00:00Z"))).toEqual([
      { platform: "ebay", sales: 1, takings: 1800, reported: true },
      { platform: "vinted", sales: 1, takings: 100, reported: false },
    ]);
  });

  it("lists the tax years with sales, newest first", () => {
    expect(salesTaxYears([sale("2026-05-01", 1), sale("2025-05-01", 1), { soldFor: "" }]).map((y) => y.label)).toEqual(["2026/27", "2025/26"]);
  });
});
