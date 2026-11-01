import { describe, expect, it } from "vitest";
import { monthlyProfit, setupSteps } from "@/lib/dashboard";
import { DEFAULT_SETTINGS } from "@/lib/profit";

const sale = (soldOn, boughtFor, soldFor) => ({ id: soldOn, soldOn, boughtFor, soldFor, platform: "vinted", postageOut: 0, fees: "" });

describe("dashboard figures", () => {
  it("totals profit by month for the last six months, empty months included", () => {
    const rows = monthlyProfit(
      [sale("2026-11-02", 100, 150), sale("2026-11-20", 50, 40), sale("2026-08-10", 80, 120), sale("2026-01-01", 10, 500)],
      DEFAULT_SETTINGS,
      new Date("2026-11-25T12:00:00Z")
    );
    expect(rows.map((row) => row.label)).toEqual(["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"]);
    expect(rows.find((row) => row.label === "Nov")).toMatchObject({ profit: 40, sales: 2 });
    expect(rows.find((row) => row.label === "Aug")).toMatchObject({ profit: 40, sales: 1 });
    expect(rows.find((row) => row.label === "Sep")).toMatchObject({ profit: 0, sales: 0 });
  });

  it("works out which setup steps are done", () => {
    const now = Date.parse("2026-11-25T12:00:00Z");
    const steps = setupSteps({ sync: "on", alerts: "off", lastBackup: now - 40 * 86_400_000, now });
    expect(steps.map((step) => step.done)).toEqual([true, true, false, false]);
    expect(setupSteps({ sync: "no-database", alerts: "unavailable", lastBackup: null, now })[0].done).toBe(false);
  });
});
