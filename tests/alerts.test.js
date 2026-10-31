import { PGlite } from "@electric-sql/pglite";
import webpush from "web-push";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestDatabase } from "@/lib/db";
import { addSubscription, countSubscriptions, isAlertDeal, quietHours, runAlerts, vapidKeys } from "@/lib/alerts";
import { DEFAULT_SETTINGS } from "@/lib/profit";
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

const subscription = { endpoint: "https://push.example/abc", keys: { p256dh: "k", auth: "a" } };
const good = { username: "s", feedbackScore: 900, feedbackPercentage: 99.9 };

// A fake eBay whose Buy It Now search returns the given listings, with
// five comparable listings around £300 for every model, enough for a
// confident estimate
function fakeEbay(listings) {
  vi.stubGlobal("fetch", async (input) => {
    const url = new URL(String(input));
    if (url.pathname.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 7200 });
    if (url.pathname.includes("taxonomy")) return new Response("no", { status: 404 });
    const q = url.searchParams.get("q");
    if (q.startsWith("(")) return Response.json({ itemSummaries: [] });
    // Resale lookups ask for prices in pounds; listing searches don't
    if (url.searchParams.get("filter").includes("priceCurrency:GBP")) {
      return Response.json({
        itemSummaries: [290, 300, 300, 300, 310].map((price) => ({ title: q, price: { value: String(price) }, itemLocation: { country: "GB" } })),
      });
    }
    return Response.json({ total: listings.length, itemSummaries: listings });
  });
}
const bin = (id, title, price) => ({
  itemId: id, title, price: { value: String(price) }, buyingOptions: ["FIXED_PRICE"], itemLocation: { country: "GB" },
  seller: { username: "s", feedbackScore: 900, feedbackPercentage: "99.9" }, shippingOptions: [{ shippingCost: { value: "0" } }],
});

describe("deal alerts", () => {
  it("makes push keys once and keeps them", async () => {
    const first = await vapidKeys();
    expect(first.publicKey).toBeTruthy();
    expect(await vapidKeys()).toEqual(first);
  });

  it("only alerts on confident deals within your limit from sellers who aren't risky", () => {
    const choices = { settings: { ...DEFAULT_SETTINGS, maxBudget: 200 }, hideRisky: true };
    const deal = { status: "deal", tooCheap: false, totalCost: 150, seller: good };
    expect(isAlertDeal(deal, choices)).toBe(true);
    expect(isAlertDeal({ ...deal, status: "check" }, choices)).toBe(false);
    expect(isAlertDeal({ ...deal, totalCost: 250 }, choices)).toBe(false);
    expect(isAlertDeal({ ...deal, seller: { feedbackScore: 3, feedbackPercentage: 100 } }, choices)).toBe(false);
  });

  it("keeps quiet overnight, UK time", () => {
    expect(quietHours(new Date("2026-12-01T02:00:00Z"))).toBe(true);
    expect(quietHours(new Date("2026-12-01T12:00:00Z"))).toBe(false);
    // 06:30 UTC is 07:30 in summer
    expect(quietHours(new Date("2026-07-01T06:30:00Z"))).toBe(false);
  });

  it("learns what's listed on the first run, then alerts on new deals only", async () => {
    await addSubscription(subscription);
    await writeState("wh-top-brands", ["Seiko"], 1000);
    const sent = vi.spyOn(webpush, "sendNotification").mockResolvedValue({ statusCode: 201 });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const midday = new Date("2026-12-01T12:00:00Z");

    fakeEbay([bin("1", "Seiko SKX007 diver", 100)]);
    const first = await runAlerts({ now: midday });
    expect(first.deals).toBe(0);
    expect(sent).not.toHaveBeenCalled();

    // Searches are reused for a minute, so the next run is later
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 5 * 60_000);
    fakeEbay([bin("1", "Seiko SKX007 diver", 100), bin("2", "Seiko SRPD55 sports", 160), bin("3", "Seiko SNK809", 290)]);
    const second = await runAlerts({ now: midday, startedAt: Date.now() });
    vi.useRealTimers();
    // Item 2: £300 x 85% less fees and postage leaves £57 profit at £160;
    // item 3 at £290 is a loss
    expect(second.deals).toBe(1);
    expect(sent).toHaveBeenCalledTimes(1);
    expect(JSON.parse(sent.mock.calls[0][1]).title).toMatch(/profit: Seiko SRPD55 sports/);
  });

  it("drops phones that have unsubscribed", async () => {
    await addSubscription(subscription);
    vi.spyOn(webpush, "sendNotification").mockRejectedValue(Object.assign(new Error("gone"), { statusCode: 410 }));
    const { sendTest } = await import("@/lib/alerts");
    expect(await sendTest()).toBe(0);
    expect(await countSubscriptions()).toBe(0);
  });

  it("alerts on wanted models at or under your price, once each", async () => {
    await addSubscription(subscription);
    await writeState("wh-top-brands", ["Nobrandatall"], 1000);
    await writeState("wh-wanted", [{ id: "skx", query: "Seiko SKX007", maxPrice: 180 }], 1000);
    const sent = vi.spyOn(webpush, "sendNotification").mockResolvedValue({ statusCode: 201 });
    vi.spyOn(console, "error").mockImplementation(() => {});
    fakeEbay([bin("w1", "Seiko SKX007 jubilee", 170), bin("w2", "Seiko SKX007 boxed", 260)]);

    const first = await runAlerts({ now: new Date("2026-12-01T12:00:00Z") });
    expect(first.wanted).toBe(1);
    expect(JSON.parse(sent.mock.calls[0][1]).title).toBe("Wanted: Seiko SKX007 at £170");

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 5 * 60_000);
    const second = await runAlerts({ now: new Date("2026-12-01T13:00:00Z"), startedAt: Date.now() });
    vi.useRealTimers();
    expect(second.wanted).toBe(0);
  });
});
