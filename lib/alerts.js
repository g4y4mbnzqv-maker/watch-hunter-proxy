import webpush from "web-push";
import { withSchema } from "./db";
import { getAuctions, getComparables, mapPool, searchListings } from "./ebay";
import { POPULAR } from "./brands";
import { DEFAULT_SETTINGS, analyse } from "./profit";
import { assessSeller } from "./seller";
import { modelKey } from "./models";
import { ukDay, withAuctionResults } from "./priceIndex";
import { cleanWanted, matchesWanted } from "./wanted";
import { isPriceDrop, isSummaryTime, keepRecentDeals, priceDropNotification, weeklySummary } from "./digest";
import { sellerMark } from "./sellerNotes";

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
// Alerts kept in the inbox on the Home tab
const INBOX_DAYS = 7;
const INBOX_SHOWN = 30;

// Saved Buy It Now listings checked for price drops each run, newest first:
// one eBay call each
const MAX_DROP_CHECKS = 20;

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
  await query(`
    CREATE TABLE IF NOT EXISTS alert_inbox (
      id bigserial PRIMARY KEY,
      title text NOT NULL,
      body text NOT NULL,
      url text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
  await query(`
    CREATE TABLE IF NOT EXISTS price_watch (
      item_id text PRIMARY KEY,
      price numeric NOT NULL,
      checked_at timestamptz NOT NULL DEFAULT now()
    )`);
});

async function readKey(query, name) {
  const [row] = await query(`SELECT value FROM app_keys WHERE name = $1`, [name]);
  return row?.value ?? null;
}

async function writeKey(query, name, value) {
  await query(
    `INSERT INTO app_keys (name, value) VALUES ($1, $2::jsonb) ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`,
    [name, JSON.stringify(value)]
  );
}

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
    `SELECT key, value FROM user_state WHERE key IN ('wh-settings', 'wh-top-brands', 'wh-model-values', 'wh-hide-risky', 'wh-wanted', 'wh-watchlist', 'wh-deals', 'wh-seller-notes')`
  ).catch(() => []);
  const saved = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    settings: { ...DEFAULT_SETTINGS, ...(saved["wh-settings"] ?? {}) },
    brands: Array.isArray(saved["wh-top-brands"]) && saved["wh-top-brands"].length ? saved["wh-top-brands"] : POPULAR,
    modelValues: saved["wh-model-values"] ?? {},
    hideRisky: saved["wh-hide-risky"] ?? true,
    wanted: cleanWanted(saved["wh-wanted"]),
    watchlist: saved["wh-watchlist"] && typeof saved["wh-watchlist"] === "object" ? saved["wh-watchlist"] : {},
    deals: Array.isArray(saved["wh-deals"]) ? saved["wh-deals"] : [],
    sellerNotes: saved["wh-seller-notes"] && typeof saved["wh-seller-notes"] === "object" ? saved["wh-seller-notes"] : {},
  };
}

// Saved Buy It Now listings whose price has fallen since the app last
// looked: against the last price checked, or the price when you saved it
async function priceDrops(query, watchlist) {
  const saved = Object.values(watchlist)
    .filter((item) => item?.itemId && item.listingType === "BUY_IT_NOW" && !item.ended)
    .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))
    .slice(0, MAX_DROP_CHECKS);
  if (!saved.length) return [];

  const { items } = await getAuctions(saved.map((item) => item.itemId));
  if (!items.length) return [];
  const rows = await query(`SELECT item_id, price FROM price_watch WHERE item_id = ANY($1::text[])`, [
    items.map((item) => item.itemId),
  ]);
  const last = Object.fromEntries(rows.map((row) => [row.item_id, Number(row.price)]));

  const drops = [];
  for (const item of items) {
    const before = last[item.itemId] ?? Number(watchlist[item.itemId]?.totalCost);
    if (isPriceDrop(before, item.totalCost)) drops.push({ item, before });
    await query(
      `INSERT INTO price_watch (item_id, price) VALUES ($1, $2)
       ON CONFLICT (item_id) DO UPDATE SET price = EXCLUDED.price, checked_at = now()`,
      [item.itemId, item.totalCost]
    );
  }
  return drops;
}

// The Sunday summary, once per Sunday evening
async function dueSummary(query, choices, now, recentDeals) {
  if (!isSummaryTime(now)) return null;
  const day = ukDay(now);
  if ((await readKey(query, "summary-sent")) === day) return null;
  await writeKey(query, "summary-sent", day);
  return weeklySummary({ deals: choices.deals, settings: choices.settings, recentDeals, now: now.getTime() });
}

// The new Buy It Now listings for a brand: ones not looked at before. The
// first check of a brand only remembers what's there, so you aren't sent
// every listing already on eBay.
async function newListings(query, brand, items) {
  const [{ n }] = await query(`SELECT count(*)::int AS n FROM alert_seen WHERE brand = $1`, [brand]);
  const fresh = await markSeen(query, brand, items, (item) => item.itemId);
  return n === 0 ? [] : fresh;
}

// Records listings as seen and returns the ones that weren't before. Ones
// already seen get their time refreshed, so a listing still up after
// SEEN_DAYS isn't forgotten and alerted on again; only listings that have
// gone are cleared out.
async function markSeen(query, scope, items, idOf) {
  if (!items.length) return [];
  const ids = items.map(idOf);
  const rows = await query(`SELECT item_id FROM alert_seen WHERE item_id = ANY($1::text[])`, [ids]);
  const seen = new Set(rows.map((row) => row.item_id));
  await query(
    `INSERT INTO alert_seen (item_id, brand) SELECT unnest($1::text[]), $2
     ON CONFLICT (item_id) DO UPDATE SET seen_at = now()`,
    [ids, scope]
  );
  return items.filter((item) => !seen.has(idOf(item)));
}

// True when a listing is worth a notification: a confident deal from a
// seller who isn't risky, within your spending limit
export function isAlertDeal(item, { settings, hideRisky, sellerNotes }) {
  if (item.status !== "deal" || item.tooCheap) return false;
  const mark = sellerMark(sellerNotes, item.seller);
  // Sellers you avoid never alert; ones you trust do even if they look risky
  if (mark === "avoid") return false;
  if (hideRisky && mark !== "trust" && assessSeller(item.seller, settings).level === "risky") return false;
  if (settings.maxBudget > 0 && item.totalCost > settings.maxBudget) return false;
  return true;
}

export function quietHours(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "numeric", hourCycle: "h23" }).format(now)
  );
  return hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR;
}

// Listings not alerted on before for this wanted model, remembered so each
// alerts once
function unseen(query, scope, items) {
  return markSeen(query, scope, items, (item) => `${scope}:${item.itemId}`);
}

function wantedNotification(item, want) {
  const auction = item.listingType !== "BUY_IT_NOW";
  return {
    title: `Wanted: ${want.query} at £${Math.round(item.totalCost)}`,
    body: `${auction ? "Auction ending soon, now" : "Buy It Now"} £${Math.round(item.totalCost)} with postage. Your limit is £${Math.round(want.maxPrice)}. ${item.title}`,
    url: item.url,
    tag: `wanted-${item.itemId}`,
  };
}

function notificationFor(item) {
  return {
    title: `£${Math.round(item.profit)} profit: ${item.title}`,
    body: `Buy It Now £${Math.round(item.totalCost)} with postage. Resale about £${Math.round(item.resale)}.`,
    url: item.url,
    tag: item.itemId,
  };
}

// Push services want a contact for the sender: the app's own address
// works, where a made-up email can be turned away
function pushSubject(origin) {
  return /^https:\/\//.test(origin ?? "") ? origin : "https://watch-hunter.vercel.app";
}

async function sendToAll(query, payload, keys, origin) {
  const subscriptions = await query(`SELECT endpoint, subscription FROM push_subscriptions`);
  let sent = 0;
  await Promise.all(
    subscriptions.map(async ({ endpoint, subscription }) => {
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload), {
          vapidDetails: { subject: pushSubject(origin), publicKey: keys.publicKey, privateKey: keys.privateKey },
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

// The latest alerts sent, newest first, for the Home tab
export async function alertInbox() {
  const query = await db();
  if (!query) return [];
  const rows = await query(
    `SELECT id, title, body, url, created_at FROM alert_inbox WHERE created_at >= now() - interval '${INBOX_DAYS} days'
     ORDER BY created_at DESC, id DESC LIMIT ${INBOX_SHOWN}`
  );
  return rows.map((row) => ({ id: Number(row.id), title: row.title, body: row.body, url: row.url, at: new Date(row.created_at).getTime() }));
}

// A test notification to every signed-up phone, to check alerts work
export async function sendTest({ origin } = {}) {
  const query = await db();
  return sendToAll(
    query,
    { title: "Watch Hunter alerts are on", body: "You'll get a notification like this when a new deal turns up.", url: "/", tag: "test" },
    await vapidKeys(),
    origin
  );
}

// One run of the alert check. Returns a report of what it did.
// quick: only the newest Buy It Now listings for your brands, without the
// misspelling searches, wanted list, price drops or Sunday summary. Run
// between the full hourly checks, so a cheap listing is seen sooner.
export async function runAlerts({ now = new Date(), startedAt = Date.now(), force = false, origin, quick = false } = {}) {
  const query = await db();
  if (!force && quietHours(now)) return { skipped: "quiet hours" };
  if ((await countSubscriptions()) === 0) return { skipped: "no phones signed up" };


  const choices = await savedChoices(query);
  const deals = [];
  const report = [];

  await mapPool(choices.brands, CONCURRENCY, async (brand) => {
    if (Date.now() - startedAt > BUDGET_MS) return report.push({ brand, skipped: "out of time" });
    try {
      const { items } = await searchListings(brand, { types: ["BUY_IT_NOW"], typos: !quick });
      const fresh = await newListings(query, brand, items);
      if (!fresh.length) return report.push({ brand, new: 0 });
      const comps = await getComparables(brand, fresh);
      const priced = await withAuctionResults(fresh.map((item) => ({ ...item, brand, comps: comps[item.itemId] ?? null })));
      const analysed = priced.map((item) => {
        const key = modelKey(item);
        const own = key && choices.modelValues[key];
        return analyse(
          item,
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

  // Wanted models at or under your price. Unlike brand checks, a listing
  // already there on the first check still counts: you asked for it.
  const wantedFound = [];
  await mapPool(quick ? [] : choices.wanted, CONCURRENCY, async (want) => {
    if (Date.now() - startedAt > BUDGET_MS) return report.push({ wanted: want.query, skipped: "out of time" });
    try {
      const { items } = await searchListings(want.query, { types: ["AUCTION", "BUY_IT_NOW"] });
      const matches = items.filter((item) => matchesWanted(item, want, now.getTime()));
      const fresh = await unseen(query, `wanted:${want.id}`, matches);
      wantedFound.push(...fresh.map((item) => ({ item, want })));
      report.push({ wanted: want.query, matches: matches.length, new: fresh.length });
    } catch (err) {
      report.push({ wanted: want.query, error: err.message });
    }
  });

  // Price drops on saved Buy It Now listings
  let drops = [];
  if (!quick && Date.now() - startedAt <= BUDGET_MS) {
    try {
      drops = await priceDrops(query, choices.watchlist);
      report.push({ priceDrops: drops.length });
    } catch (err) {
      report.push({ priceDrops: "failed", error: err.message });
    }
  }

  // Deals found this week, for the Sunday summary's "best deal found"
  const recentDeals = keepRecentDeals(await readKey(query, "recent-deals"), deals, now.getTime());
  await writeKey(query, "recent-deals", recentDeals);
  const summary = quick ? null : await dueSummary(query, choices, now, recentDeals);

  const notifications = [
    ...(summary ? [summary] : []),
    ...wantedFound.map(({ item, want }) => wantedNotification(item, want)),
    ...drops.map(priceDropNotification),
    ...deals.sort((a, b) => b.profit - a.profit).map(notificationFor),
  ];
  let sent = 0;
  if (notifications.length) {
    // Kept for the Home tab, so a missed or swiped-away alert isn't lost
    await query(
      `INSERT INTO alert_inbox (title, body, url) SELECT * FROM unnest($1::text[], $2::text[], $3::text[])`,
      [notifications.map((n) => n.title), notifications.map((n) => n.body), notifications.map((n) => n.url ?? null)]
    );
    const keys = await vapidKeys();
    for (const payload of notifications.slice(0, MAX_NOTIFICATIONS)) sent += await sendToAll(query, payload, keys, origin);
    if (notifications.length > MAX_NOTIFICATIONS) {
      sent += await sendToAll(
        query,
        { title: `${notifications.length - MAX_NOTIFICATIONS} more found`, body: "Open Watch Hunter to see them all.", url: "/", tag: `more-${ukDay(now)}` },
        keys,
        origin
      );
    }
  }

  await query(`DELETE FROM alert_seen WHERE seen_at < now() - interval '${SEEN_DAYS} days'`);
  await query(`DELETE FROM price_watch WHERE checked_at < now() - interval '${SEEN_DAYS} days'`);
  await query(`DELETE FROM alert_inbox WHERE created_at < now() - interval '${INBOX_DAYS} days'`);
  return {
    deals: deals.length,
    wanted: wantedFound.length,
    priceDrops: drops.length,
    summary: Boolean(summary),
    notificationsSent: sent,
    brands: report,
  };
}
