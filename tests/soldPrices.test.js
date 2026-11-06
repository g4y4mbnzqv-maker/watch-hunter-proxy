import { PGlite } from "@electric-sql/pglite";
import webpush from "web-push";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestDatabase } from "@/lib/db";
import { recordScan, withAuctionResults } from "@/lib/priceIndex";
import { analyse, DEFAULT_SETTINGS } from "@/lib/profit";
import { addSubscription, runAlerts } from "@/lib/alerts";
import { writeState } from "@/lib/userState";

let pg;
beforeEach(() => {
  pg = new PGlite();
  setTestDatabase(async (text, params) => (await pg.query(text, params)).rows);
  process.env.EBAY_CLIENT_ID = "id";
  process.env.EBAY_CLIENT_SECRET = "secret";
});
afterEach(() => {
  setTestDatabase(null);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const now = new Date("2026-11-06T12:00:00Z");
// An auction with bids, 30 minutes from its end
const closing = (id, price) => ({
  itemId: id, title: "Seiko SKX007", modelRef: "SKX007", conditionGroup: "USED", listingType: "AUCTION",
  bidCount: 5, currentBid: price, endTime: new Date(now.getTime() + 30 * 60_000).toISOString(),
});

describe("estimates from auction results", () => {
  it("uses recent results once there are 4, in place of asking prices", async () => {
    await recordScan([closing("a", 150), closing("b", 160), closing("c", 170)], { brand: "Seiko", now });
    const listing = { itemId: "x", title: "Seiko SKX007 diver", modelRef: "SKX007", conditionGroup: "USED", currentBid: 100, postage: 0,
      listingType: "BUY_IT_NOW", comps: { median: 300, low: 250, high: 350, count: 8 } };

    let [item] = await withAuctionResults([listing], { now });
    expect(item.sold).toBeUndefined();
    expect(analyse(item, DEFAULT_SETTINGS)).toMatchObject({ resale: 255, resaleSource: "comps" });

    await recordScan([closing("d", 180)], { brand: "Seiko", now });
    [item] = await withAuctionResults([listing], { now });
    expect(item.sold).toMatchObject({ median: 165, count: 4, condition: "USED" });
    expect(analyse(item, DEFAULT_SETTINGS)).toMatchObject({ resale: 165, resaleSource: "sold", brandPercent: null });
  });

  it("leaves listings alone without a database", async () => {
    setTestDatabase(null);
    const items = [{ itemId: "x", modelRef: "SKX007" }];
    expect(await withAuctionResults(items)).toEqual(items);
  });
});

describe("quick alert checks", () => {
  it("only search the newest Buy It Now listings", async () => {
    await addSubscription({ endpoint: "https://push.example/a", keys: { p256dh: "k", auth: "a" } });
    await writeState("wh-top-brands", ["Seiko"], 1);
    await writeState("wh-wanted", [{ id: "w", query: "Tudor Black Bay", maxPrice: 1800 }], 1);
    vi.spyOn(webpush, "sendNotification").mockResolvedValue({ statusCode: 201 });
    const queries = [];
    vi.stubGlobal("fetch", async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 7200 });
      if (url.pathname.includes("taxonomy")) return new Response("no", { status: 404 });
      queries.push(url.searchParams.get("q"));
      return Response.json({ total: 0, itemSummaries: [] });
    });
    const report = await runAlerts({ now, quick: true });
    expect(queries).toEqual(["seiko"]);
    expect(report.summary).toBe(false);
  });
});
