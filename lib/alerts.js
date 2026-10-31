import webpush from "web-push";
import { withSchema } from "./db";
import { getComparables, mapPool, searchListings } from "./ebay";
import { POPULAR } from "./brands";
import { DEFAULT_SETTINGS, analyse } from "./profit";
import { assessSeller } from "./seller";
import { modelKey } from "./models";
import { ukDay } from "./priceIndex";

// Deal alerts while the app is closed. A scheduled job checks the newest
// Buy It Now listings for your Top deals brands, works out profit with your
// own settings, and sends a phone notification for each new deal. Push
// keys are made on first use and kept in the database, so there's nothing
// to set up beyond the schedule.

// Brands checked at once
const CONCURRENCY = 3;
// Stop starting new brands after this long, to finish inside the time limit
const BUDGET_MS = 45_000;
// Notifications per run; more deals than this are summed up in one
const MAX_NOTIFICATIONS = 5;
// No alerts overnight, UK time
const QUIET_FROM_HOUR = 23;
const QUIET_UNTIL_HOUR = 7;
// Listings already looked at are remembered this long
const SEEN_DAYS = 14;

const db = withSchema(async (query) => {
  await query(`CREATE TABLE IF NOT EXISTS app_keys (name text PRIMARY KEY, value jsonb NOT NULL)`);
  await query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint text PRIMARY KEY,
      subscription jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
  await query(`
    CREATE TABLE IF NOT EXISTS alert_seen (
      item_id text PRIMARY KEY,
      brand text NOT NULL,
      seen_at timestamptz NOT NULL DEFAULT now()
    )`);
});

// The push keys, made and saved the first time they're needed
export async function vapidKeys() {
  const query = await db();
  const [row] = await query(`SELECT value FROM app_keys WHERE name = 'vapid'`);
  if (row) return row.value;
  const keys = webpush.generateVAPIDKeys();
  // Two first requests at once keep whichever saved first
  await query(`INSERT INTO app_keys (name, value) VALUES ('vapid', $1::jsonb) ON CONFLICT (name) DO NOTHING`, [
    JSON.stringify(keys),
  ]);
  const [saved] = await query(`SELECT value FROM app_keys WHERE name = 'vapid'`);
  return saved.value;
}

export async function addSubscription(subscription) {
  const query = await db();
  await query(
    `INSERT INTO push_subscriptions (endpoint, subscription) VALUES ($1, $2::jsonb)
     ON CONFLICT (endpoint) DO UPDATE SET subscription = EXCLUDED.subscription`,
    [subscription.endpoint, JSON.stringify(subscription)]
  );
}

export async function removeSubscription(endpoint) {
  const query = await db();
  await query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
}

export async function countSubscriptions() {
  const query = await db();
  const [row] = await query(`SELECT count(*)::int AS n FROM push_subscriptions`);
  return row.n;
}

// Your saved settings, brands and resale values, as synced from the app
async function savedChoices(query) {
  const rows = await query(
    `SELECT key, value FROM user_state WHERE key IN ('wh-settings', 'wh-top-brands', 'wh-model-values', 'wh-hide-risky')`
  ).catch(() => []);
  const saved = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    settings: { ...DEFAULT_SETTINGS, ...(saved["wh-settings"] ?? {}) },
    brands: Array.isArray(saved["wh-top-brands"]) && saved["wh-top-brands"].length ? saved["wh-top-brands"] : POPULAR,
    modelValues: saved["wh-model-values"] ?? {},
    hideRisky: saved["wh-hide-risky"] ?? true,
  };
}

// The new Buy It Now listings for a brand: ones not looked at before. The
// first check of a brand only remembers what's there, so you aren't sent
// every listing already on eBay.
async function newListings(query, brand, items) {
  const [{ n }] = await query(`SELECT count(*)::int AS n FROM alert_seen WHERE brand = $1`, [brand]);
  const ids = items.map((item) => item.itemId);
  const seenRows = ids.length ? await query(`SELECT item_id FROM alert_seen WHERE item_id = ANY($1::text[])`, [ids]) : [];
  const seen = new Set(seenRows.map((row) => row.item_id));
  const fresh = items.filter((item) => !seen.has(item.itemId));
  if (fresh.length) {
    await query(
      `INSERT INTO alert_seen (item_id, brand) SELECT unnest($1::text[]), $2 ON CONFLICT (item_id) DO NOTHING`,
      [fresh.map((item) => item.itemId), brand]
    );
  }
  return n === 0 ? [] : fresh;
}

// True when a listing is worth a notification: a confident deal from a
// seller who isn't risky, within your spending limit
export function isAlertDeal(item, { settings, hideRisky }) {
  if (item.status !== "deal" || item.tooCheap) return false;
  if (hideRisky && assessSeller(item.seller, settings).level === "risky") return false;
  if (settings.maxBudget > 0 && item.totalCost > settings.maxBudget) return false;
  return true;
}

export function quietHours(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "numeric", hourCycle: "h23" }).format(now)
  );
  return hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR;
}

function notificationFor(item) {
  return {
    title: `£${Math.round(item.profit)} profit: ${item.title}`,
    body: `Buy It Now £${Math.round(item.totalCost)} with postage. Resale about £${Math.round(item.resale)}.`,
    url: item.url,
    tag: item.itemId,
  };
}

async function sendToAll(query, payload, keys) {
  const subscriptions = await query(`SELECT endpoint, subscription FROM push_subscriptions`);
  let sent = 0;
  await Promise.all(
    subscriptions.map(async ({ endpoint, subscription }) => {
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload), {
          vapidDetails: { subject: "mailto:alerts@watch-hunter.invalid", publicKey: keys.publicKey, privateKey: keys.privateKey },
          TTL: 60 * 60,
        });
        sent++;
      } catch (err) {
        // The phone unsubscribed or the app was removed
        if (err.statusCode === 404 || err.statusCode === 410) await removeSubscription(endpoint);
        else console.error("Push failed:", err.statusCode, err.body ?? err.message);
      }
    })
  );
  return sent;
}

// A test notification to every signed-up phone, to check alerts work
export async function sendTest() {
  const query = await db();
  return sendToAll(
    query,
    { title: "Watch Hunter alerts are on", body: "You'll get a notification like this when a new deal turns up.", url: "/", tag: "test" },
    await vapidKeys()
  );
}

// One run of the alert check. Returns a report of what it did.
export async function runAlerts({ now = new Date(), startedAt = Date.now(), force = false } = {}) {
  const query = await db();
  if (!force && quietHours(now)) return { skipped: "quiet hours" };
  if ((await countSubscriptions()) === 0) return { skipped: "no phones signed up" };

  const choices = await savedChoices(query);
  const deals = [];
  const report = [];

  await mapPool(choices.brands, CONCURRENCY, async (brand) => {
    if (Date.now() - startedAt > BUDGET_MS) return report.push({ brand, skipped: "out of time" });
    try {
      const { items } = await searchListings(brand, { types: ["BUY_IT_NOW"] });
      const fresh = await newListings(query, brand, items);
      if (!fresh.length) return report.push({ brand, new: 0 });
      const comps = await getComparables(brand, fresh);
      const analysed = fresh.map((item) => {
        const key = modelKey(item);
        const own = key && choices.modelValues[key];
        return analyse(
          { ...item, brand, comps: comps[item.itemId] ?? null },
          choices.settings,
          own ? { value: own, source: "model" } : undefined
        );
      });
      const found = analysed.filter((item) => isAlertDeal(item, choices));
      deals.push(...found);
      report.push({ brand, new: fresh.length, deals: found.length });
    } catch (err) {
      report.push({ brand, error: err.message });
    }
  });

  let sent = 0;
  if (deals.length) {
    const keys = await vapidKeys();
    deals.sort((a, b) => b.profit - a.profit);
    for (const item of deals.slice(0, MAX_NOTIFICATIONS)) sent += await sendToAll(query, notificationFor(item), keys);
    if (deals.length > MAX_NOTIFICATIONS) {
      sent += await sendToAll(
        query,
        { title: `${deals.length - MAX_NOTIFICATIONS} more deals found`, body: "Open Watch Hunter to see them all.", url: "/", tag: `more-${ukDay(now)}` },
        keys
      );
    }
  }

  await query(`DELETE FROM alert_seen WHERE seen_at < now() - interval '${SEEN_DAYS} days'`);
  return { deals: deals.length, notificationsSent: sent, brands: report };
}
