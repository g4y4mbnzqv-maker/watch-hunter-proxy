import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { listModels, modelHistory, priceIndexEnabled, recordScan, setTestDatabase, ukDay } from "@/lib/priceIndex";

let pg;

beforeEach(async () => {
  // A real Postgres in memory, fresh for each test
  pg = new PGlite();
  setTestDatabase(async (text, params) => (await pg.query(text, params)).rows);
});

const at = (iso) => new Date(iso);
const minutesFrom = (now, minutes) => new Date(now.getTime() + minutes * 60_000).toISOString();
const comps = (median, extra = {}) => ({ median, low: median - 40, high: median + 40, count: 8, condition: "USED", ...extra });

describe("recordScan", () => {
  it("keeps one asking-price summary per model, condition and day, the latest winning", async () => {
    const morning = at("2026-10-20T09:00:00Z");
    await recordScan([{ itemId: "1", modelRef: "SRPD55K1", comps: comps(200) }], { brand: "Seiko", now: morning });
    await recordScan(
      [
        { itemId: "2", modelRef: "SRPD55J1", comps: comps(210) },
        { itemId: "3", modelName: "Seiko Turtle", comps: comps(300, { condition: null }) },
        { itemId: "4", title: "no model", comps: comps(100) },
      ],
      { brand: "Seiko", now: at("2026-10-20T15:00:00Z") }
    );

    const rows = (await pg.query("SELECT model_key, label, brand, condition, median FROM price_snapshots ORDER BY model_key")).rows;
    expect(rows).toEqual([
      { model_key: "name:Seiko Turtle", label: "Seiko Turtle", brand: "Seiko", condition: "ANY", median: 300 },
      { model_key: "ref:SRPD55", label: "SRPD55", brand: "Seiko", condition: "USED", median: 210 },
    ]);
  });

  it("records auctions in their last hour once each, keeping the highest bid, and nothing identifying", async () => {
    const now = at("2026-10-20T20:00:00Z");
    const closing = { itemId: "v1|999|0", title: "Seiko SKX007 secret title", modelRef: "SKX007", listingType: "AUCTION", bidCount: 5, conditionGroup: "USED" };
    await recordScan(
      [
        { ...closing, currentBid: 150, endTime: minutesFrom(now, 30) },
        { ...closing, itemId: "later", currentBid: 90, endTime: minutesFrom(now, 300) },
        { ...closing, itemId: "nobids", bidCount: 0, currentBid: 1, endTime: minutesFrom(now, 10) },
        { ...closing, itemId: "bin", listingType: "BUY_IT_NOW", currentBid: 200, endTime: null },
      ],
      { now }
    );
    await recordScan([{ ...closing, currentBid: 175, endTime: minutesFrom(now, 20) }], { now: at("2026-10-20T20:10:00Z") });

    const rows = (await pg.query("SELECT * FROM auction_closes")).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ model_key: "ref:SKX007", price: 175, condition: "USED" });
    expect(JSON.stringify(rows)).not.toMatch(/secret|v1\|999/);
  });
});

describe("listModels and modelHistory", () => {
  it("reports the latest median, change since about 30 days ago, a sparkline and recent closes", async () => {
    const snap = (day, median) =>
      recordScan([{ itemId: day, modelRef: "SKX007", comps: comps(median) }], { brand: "Seiko", now: at(`${day}T12:00:00Z`) });
    await snap("2026-07-01", 250);
    await snap("2026-09-18", 280);
    await snap("2026-10-10", 300);
    await snap("2026-10-20", 308);
    const now = at("2026-10-20T21:00:00Z");
    await recordScan(
      [{ itemId: "a", modelRef: "SKX007", listingType: "AUCTION", bidCount: 3, currentBid: 260, endTime: minutesFrom(now, 15) }],
      { now }
    );

    const [model] = await listModels({ now });
    expect(model).toMatchObject({
      modelKey: "ref:SKX007",
      condition: "USED",
      label: "SKX007",
      brand: "Seiko",
      day: "2026-10-20",
      median: 308,
      // Against 18 Sep, the newest snapshot at least 30 days old
      change: { since: "2026-09-18", percent: 10 },
      closes: { count: 1, median: 260 },
    });
    // 1 Jul is more than 90 days back, so it isn't in the sparkline
    expect(model.spark.map((point) => point.day)).toEqual(["2026-09-18", "2026-10-10", "2026-10-20"]);

    const history = await modelHistory("ref:SKX007", { now });
    expect(history.asking.map((point) => point.median)).toEqual([250, 280, 300, 308]);
    expect(history.closes).toEqual([{ day: "2026-10-20", count: 1, median: 260, low: 260, high: 260 }]);
  });

  it("measures change from the oldest snapshot when history is shorter than 30 days", async () => {
    for (const [day, median] of [["2026-10-12", 200], ["2026-10-20", 190]]) {
      await recordScan([{ itemId: day, modelRef: "SKX009", comps: comps(median) }], { now: at(`${day}T12:00:00Z`) });
    }
    const [model] = await listModels({ now: at("2026-10-20T12:00:00Z") });
    expect(model.change).toEqual({ since: "2026-10-12", percent: -5 });
  });
});

describe("without a database", () => {
  it("does nothing and says so", async () => {
    setTestDatabase(null);
    const saved = [process.env.DATABASE_URL, process.env.POSTGRES_URL];
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    expect(priceIndexEnabled()).toBe(false);
    expect(await recordScan([{ itemId: "1", modelRef: "SKX007", comps: comps(1) }])).toBeNull();
    expect(await listModels()).toBeNull();
    [process.env.DATABASE_URL, process.env.POSTGRES_URL] = saved;
  });
});

it("uses the UK date", () => {
  expect(ukDay(at("2026-07-01T23:30:00Z"))).toBe("2026-07-02");
  expect(ukDay(at("2026-12-01T23:30:00Z"))).toBe("2026-12-01");
});
