import { PGlite } from "@electric-sql/pglite";
import webpush from "web-push";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestDatabase } from "@/lib/db";
import { addSubscription, runAlerts } from "@/lib/alerts";
import { writeState } from "@/lib/userState";
import { DEFAULT_SETTINGS } from "@/lib/profit";
import { isPriceDrop, isSummaryTime, keepRecentDeals, weeklySummary } from "@/lib/digest";

describe("price drops", () => {
  it("counts a drop of at least £5 or 5%, whichever is more", () => {
    expect(isPriceDrop(100, 95)).toBe(true);
    expect(isPriceDrop(100, 96)).toBe(false);
    expect(isPriceDrop(400, 385)).toBe(false);
    expect(isPriceDrop(400, 380)).toBe(true);
    expect(isPriceDrop(100, 110)).toBe(false);
    expect(isPriceDrop(undefined, 50)).toBe(false);
  });
});

describe("Sunday summary", () => {
  it("is due on Sunday evenings, UK time", () => {
    expect(isSummaryTime(new Date("2026-11-08T18:30:00Z"))).toBe(true); // Sun 18:30 GMT
    expect(isSummaryTime(new Date("2026-11-08T12:00:00Z"))).toBe(false);
    expect(isSummaryTime(new Date("2026-11-09T18:30:00Z"))).toBe(false); // Monday
    expect(isSummaryTime(new Date("2026-07-05T17:30:00Z"))).toBe(true); // 18:30 BST
  });

  it("sums up the week", () => {
    const now = Date.parse("2026-11-08T18:30:00Z");
    const deals = [
      { id: "a", title: "Seiko", boughtOn: "2026-10-20", boughtFor: 100, soldOn: "2026-11-05", soldFor: 180, platform: "vinted", fees: "", postageOut: 0 },
      { id: "b", title: "Citizen", boughtOn: "2026-11-06", boughtFor: 60, soldOn: "", soldFor: "" },
    ];
    const recent = keepRecentDeals([], [{ profit: 72.4, title: "Orient Bambino", url: "u" }], now);
    const summary = weeklySummary({ deals, settings: DEFAULT_SETTINGS, recentDeals: recent, now });
    expect(summary.title).toBe("Your week: £80 profit");
    expect(summary.body).toBe("Sold 1 for £80 profit. Bought 1 for £60. 1 in stock (£60 paid). Best deal found: £72 on Orient Bambino.");
    expect(keepRecentDeals(recent, [], now + 8 * 86_400_000)).toEqual([]);
  });
});

describe("in the hourly check", () => {
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

  // eBay with no new listings, where saved item "v1|7|0" costs price
  function fakeEbay(price) {
    vi.stubGlobal("fetch", async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 7200 });
      if (url.pathname.includes("taxonomy")) return new Response("no", { status: 404 });
      if (url.pathname.includes("/item/")) {
        return Response.json({
          itemId: "v1|7|0", title: "Tissot PRX", itemWebUrl: "https://www.ebay.co.uk/itm/7", price: { value: String(price) },
          buyingOptions: ["FIXED_PRICE"], shippingOptions: [{ shippingCost: { value: "0" } }],
        });
      }
      return Response.json({ total: 0, itemSummaries: [] });
    });
  }

  it("sends a price drop once, then the Sunday summary once", async () => {
    await addSubscription({ endpoint: "https://push.example/a", keys: { p256dh: "k", auth: "a" } });
    await writeState("wh-top-brands", ["Seiko"], 1);
    await writeState("wh-watchlist", { "v1|7|0": { itemId: "v1|7|0", listingType: "BUY_IT_NOW", totalCost: 300, savedAt: 1 } }, 1);
    const sent = vi.spyOn(webpush, "sendNotification").mockResolvedValue({ statusCode: 201 });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sundayLunch = new Date("2026-11-08T12:00:00Z");

    fakeEbay(270);
    const first = await runAlerts({ now: sundayLunch });
    expect(first.priceDrops).toBe(1);
    expect(JSON.parse(sent.mock.calls[0][1]).title).toBe("Price drop: £300 to £270");

    // Same price an hour later: nothing new
    const second = await runAlerts({ now: new Date("2026-11-08T13:00:00Z") });
    expect(second.priceDrops).toBe(0);
    expect(second.summary).toBe(false);

    const evening = await runAlerts({ now: new Date("2026-11-08T18:10:00Z") });
    expect(evening.summary).toBe(true);
    expect(JSON.parse(sent.mock.calls.at(-1)[1]).title).toBe("Your week in Watch Hunter");
    const later = await runAlerts({ now: new Date("2026-11-08T19:10:00Z") });
    expect(later.summary).toBe(false);
  });
});
