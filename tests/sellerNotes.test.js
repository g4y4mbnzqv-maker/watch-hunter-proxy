import { PGlite } from "@electric-sql/pglite";
import webpush from "web-push";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestDatabase } from "@/lib/db";
import { sellerMark, withSellerMark } from "@/lib/sellerNotes";
import { addSubscription, alertInbox, isAlertDeal, runAlerts } from "@/lib/alerts";
import { DEFAULT_SETTINGS } from "@/lib/profit";
import { goalProgress } from "@/lib/dashboard";
import { writeState } from "@/lib/userState";

describe("seller notes", () => {
  it("marks, changes and clears, ignoring case", () => {
    let notes = withSellerMark({}, "Watch_Shop", "trust", 1);
    expect(sellerMark(notes, { username: "watch_shop" })).toBe("trust");
    notes = withSellerMark(notes, "WATCH_SHOP", "avoid", 2);
    expect(sellerMark(notes, { username: "Watch_Shop" })).toBe("avoid");
    expect(sellerMark(withSellerMark(notes, "watch_shop", null), { username: "watch_shop" })).toBeNull();
    expect(sellerMark(notes, null)).toBeNull();
  });

  it("decide alerts: avoided never, trusted even when the figures look risky", () => {
    const deal = { status: "deal", tooCheap: false, totalCost: 100, seller: { username: "newbie", feedbackScore: 2, feedbackPercentage: 100 } };
    const choices = { settings: DEFAULT_SETTINGS, hideRisky: true, sellerNotes: {} };
    expect(isAlertDeal(deal, choices)).toBe(false);
    expect(isAlertDeal(deal, { ...choices, sellerNotes: withSellerMark({}, "newbie", "trust") })).toBe(true);
    const good = { ...deal, seller: { username: "pro", feedbackScore: 900, feedbackPercentage: 99.9 } };
    expect(isAlertDeal(good, { ...choices, sellerNotes: withSellerMark({}, "pro", "avoid") })).toBe(false);
  });
});

describe("monthly goal", () => {
  it("shows progress, what's left and the daily pace", () => {
    expect(goalProgress(120, 0)).toBeNull();
    expect(goalProgress(120, 300, new Date(2026, 10, 21))).toEqual({ percent: 40, remaining: 180, daysLeft: 10, perDay: 18 });
    expect(goalProgress(350, 300, new Date(2026, 10, 30))).toMatchObject({ percent: 100, remaining: 0, perDay: 0 });
  });
});

describe("alert inbox", () => {
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

  it("keeps every alert sent, newest first", async () => {
    await addSubscription({ endpoint: "https://push.example/a", keys: { p256dh: "k", auth: "a" } });
    await writeState("wh-top-brands", ["Seiko"], 1);
    await writeState("wh-watchlist", { "v1|7|0": { itemId: "v1|7|0", listingType: "BUY_IT_NOW", totalCost: 300, savedAt: 1 } }, 1);
    vi.spyOn(webpush, "sendNotification").mockResolvedValue({ statusCode: 201 });
    vi.stubGlobal("fetch", async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 7200 });
      if (url.pathname.includes("taxonomy")) return new Response("no", { status: 404 });
      if (url.pathname.includes("/item/")) {
        return Response.json({ itemId: "v1|7|0", title: "Tissot PRX", itemWebUrl: "https://www.ebay.co.uk/itm/7", price: { value: "250" }, buyingOptions: ["FIXED_PRICE"] });
      }
      return Response.json({ total: 0, itemSummaries: [] });
    });
    await runAlerts({ now: new Date("2026-11-04T12:00:00Z") });
    const inbox = await alertInbox();
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ title: "Price drop: £300 to £250", url: "https://www.ebay.co.uk/itm/7" });
  });
});
