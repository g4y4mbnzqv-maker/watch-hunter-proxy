import { createHash } from "node:crypto";
import { getQuery, setTestDatabase, withSchema } from "./db";
import { indexModel } from "./indexKey";

// Only summaries are kept: a daily median and range of asking prices per
// model and condition, and for auctions seen in their last hour, the bid
// against a one-way hash of the listing ID. No titles, photos, sellers or
// links are stored.

// Auctions with this little time left count as "closing"
const CLOSING_HOURS = 1;
// Days of history the index list and charts look back over
export const HISTORY_DAYS = 365;
// The change figure compares against prices about this many days ago
const CHANGE_DAYS = 30;

export { setTestDatabase };

export function priceIndexEnabled() {
  return Boolean(getQuery());
}

const db = withSchema(createSchema);

async function createSchema(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS price_snapshots (
      day date NOT NULL,
      model_key text NOT NULL,
      label text NOT NULL,
      brand text,
      condition text NOT NULL,
      median double precision NOT NULL,
      low double precision NOT NULL,
      high double precision NOT NULL,
      listings integer NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (day, model_key, condition)
    )`);
  await query(`
    CREATE TABLE IF NOT EXISTS auction_closes (
      item_hash text PRIMARY KEY,
      day date NOT NULL,
      model_key text NOT NULL,
      label text NOT NULL,
      brand text,
      condition text NOT NULL,
      price double precision NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
  await query(`CREATE INDEX IF NOT EXISTS auction_closes_model ON auction_closes (model_key, day)`);
  // When the auction ends, for the best-time-to-sell figures. Older rows
  // have none.
  await query(`ALTER TABLE auction_closes ADD COLUMN IF NOT EXISTS ends_at timestamptz`);
}

// Today in the UK, as YYYY-MM-DD
export function ukDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(date);
}

function daysBefore(day, days) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export { indexModel };

// Auction results with their end times from the last SOLD_DAYS, for
// lib/sellTiming.js. Returns [] without a database.
export async function auctionEndings({ now = new Date() } = {}) {
  const query = await db();
  if (!query) return [];
  const rows = await query(
    `SELECT model_key, price, ends_at FROM auction_closes WHERE ends_at IS NOT NULL AND day >= $1::date`,
    [daysBefore(ukDay(now), SOLD_DAYS)]
  );
  return rows.map((row) => ({ model: row.model_key, price: row.price, endsAt: new Date(row.ends_at).getTime() }));
}

// Real results: auction closes are kept this long for resale estimates
export const SOLD_DAYS = 90;
// ...and need at least this many of the same model to be used
export const MIN_SOLD = 4;

// Recent auction results for some models, as { [modelKey]: { median, low,
// high, count, condition } } where there are at least MIN_SOLD, matching
// the condition when enough do and any condition otherwise. Each price is
// the last bid seen in the auction's final hour, so final prices were often
// a little higher. Returns {} without a database.
export async function auctionResults(keys, { now = new Date() } = {}) {
  const query = await db();
  if (!query || !keys.length) return {};
  const rows = await query(
    `SELECT model_key, condition, price FROM auction_closes WHERE model_key = ANY($1::text[]) AND day >= $2::date`,
    [[...new Set(keys.map((key) => key.model))], daysBefore(ukDay(now), SOLD_DAYS)]
  );
  const prices = {};
  for (const row of rows) {
    const byModel = (prices[row.model_key] ??= { ANY: [] });
    (byModel[row.condition] ??= []).push(row.price);
    byModel.ANY.push(row.price);
  }
  const results = {};
  for (const { model, condition } of keys) {
    const byModel = prices[model];
    if (!byModel) continue;
    const same = condition && byModel[condition]?.length >= MIN_SOLD ? byModel[condition] : null;
    const list = same ?? (byModel.ANY.length >= MIN_SOLD ? byModel.ANY : null);
    if (!list) continue;
    const sorted = [...list].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    results[`${model}|${condition ?? ""}`] = {
      median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
      low: sorted[0],
      high: sorted[sorted.length - 1],
      count: sorted.length,
      condition: same ? condition : null,
    };
  }
  return results;
}

// Adds recent auction results to listings as item.sold, where there are
// enough. Never fails a scan: without a database or on an error, listings
// come back unchanged.
export async function withAuctionResults(items, { now } = {}) {
  try {
    const keyed = items.map((item) => ({ item, model: indexModel(item)?.key, condition: item.conditionGroup ?? null }));
    const results = await auctionResults(
      keyed.filter((row) => row.model).map(({ model, condition }) => ({ model, condition })),
      { now }
    );
    return keyed.map(({ item, model, condition }) => {
      const sold = model && results[`${model}|${condition ?? ""}`];
      return sold ? { ...item, sold } : item;
    });
  } catch (err) {
    console.error("Couldn't add auction results:", err.message);
    return items;
  }
}


function hashItemId(itemId) {
  return createHash("sha256").update(`watch-hunter:${itemId}`).digest("hex").slice(0, 32);
}

// Records what a scan found: each model's asking-price summary, and the bid
// on any auction in its last hour. Returns counts, or null without a
// database.
export async function recordScan(listings, { brand = null, now = new Date() } = {}) {
  const query = await db();
  if (!query) return null;

  const day = ukDay(now);
  const snapshots = new Map();
  const closes = [];

  for (const item of listings) {
    const model = indexModel(item);
    if (!model) continue;

    if (item.comps) {
      const condition = item.comps.condition ?? "ANY";
      snapshots.set(`${model.key}|${condition}`, {
        model,
        condition,
        brand: item.brand ?? brand,
        comps: item.comps,
      });
    }

    const hoursLeft = item.endTime ? (new Date(item.endTime) - now) / 3_600_000 : null;
    if (
      item.listingType !== "BUY_IT_NOW" &&
      item.bidCount > 0 &&
      hoursLeft !== null &&
      hoursLeft > 0 &&
      hoursLeft <= CLOSING_HOURS
    ) {
      closes.push({
        hash: hashItemId(item.itemId),
        model,
        brand: item.brand ?? brand,
        condition: item.conditionGroup ?? "ANY",
        price: item.currentBid,
        endsAt: item.endTime,
      });
    }
  }

  const rows = [...snapshots.values()];
  if (rows.length) {
    // One statement for all models; the latest scan of the day wins
    await query(
      `INSERT INTO price_snapshots (day, model_key, label, brand, condition, median, low, high, listings)
       SELECT $1::date, * FROM unnest($2::text[], $3::text[], $4::text[], $5::text[],
         $6::float8[], $7::float8[], $8::float8[], $9::int[])
       ON CONFLICT (day, model_key, condition) DO UPDATE SET
         label = EXCLUDED.label, brand = COALESCE(EXCLUDED.brand, price_snapshots.brand),
         median = EXCLUDED.median, low = EXCLUDED.low, high = EXCLUDED.high,
         listings = EXCLUDED.listings, updated_at = now()`,
      [
        day,
        rows.map((row) => row.model.key),
        rows.map((row) => row.model.label),
        rows.map((row) => row.brand),
        rows.map((row) => row.condition),
        rows.map((row) => row.comps.median),
        rows.map((row) => row.comps.low),
        rows.map((row) => row.comps.high),
        rows.map((row) => row.comps.count),
      ]
    );
  }

  if (closes.length) {
    // The same auction seen twice keeps its highest bid
    await query(
      `INSERT INTO auction_closes (item_hash, day, model_key, label, brand, condition, price, ends_at)
       SELECT * FROM unnest($1::text[], $2::date[], $3::text[], $4::text[], $5::text[], $6::text[], $7::float8[], $8::timestamptz[])
       ON CONFLICT (item_hash) DO UPDATE SET
         price = GREATEST(auction_closes.price, EXCLUDED.price), day = EXCLUDED.day,
         ends_at = COALESCE(EXCLUDED.ends_at, auction_closes.ends_at), updated_at = now()`,
      [
        closes.map((close) => close.hash),
        closes.map(() => day),
        closes.map((close) => close.model.key),
        closes.map((close) => close.model.label),
        closes.map((close) => close.brand),
        closes.map((close) => close.condition),
        closes.map((close) => close.price),
        closes.map((close) => close.endsAt ?? null),
      ]
    );
  }

  return { models: rows.length, closes: closes.length };
}

// Every tracked model and condition: latest median, change over about 30
// days, recent medians for a sparkline, and auction closes in 30 days
export async function listModels({ now = new Date() } = {}) {
  const query = await db();
  if (!query) return null;

  const today = ukDay(now);
  const from = daysBefore(today, 90);

  const [latest, base, recent, closes] = await Promise.all([
    query(
      `SELECT DISTINCT ON (model_key, condition) model_key, condition, label, brand, day::text AS day,
         median, low, high, listings
       FROM price_snapshots ORDER BY model_key, condition, day DESC`
    ),
    // The newest snapshot at least 30 days old, or failing that the oldest
    query(
      `SELECT DISTINCT ON (model_key, condition) model_key, condition, day::text AS day, median
       FROM price_snapshots
       ORDER BY model_key, condition, (day <= $1::date) DESC,
         CASE WHEN day <= $1::date THEN day END DESC, day ASC`,
      [daysBefore(today, CHANGE_DAYS)]
    ),
    query(
      `SELECT model_key, condition, day::text AS day, median FROM price_snapshots
       WHERE day >= $1::date ORDER BY day`,
      [from]
    ),
    query(
      `SELECT model_key, count(*)::int AS closes,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY price) AS median
       FROM auction_closes WHERE day >= $1::date GROUP BY model_key`,
      [daysBefore(today, CHANGE_DAYS)]
    ),
  ]);

  const key = (row) => `${row.model_key}|${row.condition}`;
  const baseBy = new Map(base.map((row) => [key(row), row]));
  const sparkBy = new Map();
  for (const row of recent) {
    if (!sparkBy.has(key(row))) sparkBy.set(key(row), []);
    sparkBy.get(key(row)).push({ day: row.day, median: Number(row.median) });
  }
  const closesBy = new Map(closes.map((row) => [row.model_key, row]));

  return latest.map((row) => {
    const start = baseBy.get(key(row));
    const median = Number(row.median);
    const startMedian = start ? Number(start.median) : null;
    const close = closesBy.get(row.model_key);
    return {
      modelKey: row.model_key,
      condition: row.condition,
      label: row.label,
      brand: row.brand,
      day: row.day,
      median,
      low: Number(row.low),
      high: Number(row.high),
      listings: Number(row.listings),
      change:
        start && start.day !== row.day && startMedian > 0
          ? { since: start.day, percent: Math.round(((median - startMedian) / startMedian) * 1000) / 10 }
          : null,
      spark: sparkBy.get(key(row)) ?? [],
      closes: close ? { count: Number(close.closes), median: Number(close.median) } : null,
    };
  });
}

// One model's history: daily asking-price summaries by condition, and daily
// auction closes
export async function modelHistory(modelKey, { now = new Date() } = {}) {
  const query = await db();
  if (!query) return null;

  const from = daysBefore(ukDay(now), HISTORY_DAYS);
  const [snapshots, closes] = await Promise.all([
    query(
      `SELECT day::text AS day, condition, label, brand, median, low, high, listings
       FROM price_snapshots WHERE model_key = $1 AND day >= $2::date ORDER BY day`,
      [modelKey, from]
    ),
    query(
      `SELECT day::text AS day, count(*)::int AS closes,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY price) AS median,
         min(price) AS low, max(price) AS high
       FROM auction_closes WHERE model_key = $1 AND day >= $2::date
       GROUP BY day ORDER BY day`,
      [modelKey, from]
    ),
  ]);

  return {
    modelKey,
    label: snapshots[0]?.label ?? null,
    brand: snapshots.find((row) => row.brand)?.brand ?? null,
    asking: snapshots.map((row) => ({
      day: row.day,
      condition: row.condition,
      median: Number(row.median),
      low: Number(row.low),
      high: Number(row.high),
      listings: Number(row.listings),
    })),
    closes: closes.map((row) => ({
      day: row.day,
      count: Number(row.closes),
      median: Number(row.median),
      low: Number(row.low),
      high: Number(row.high),
    })),
  };
}

// Drops history older than the charts show
export async function pruneHistory({ now = new Date() } = {}) {
  const query = await db();
  if (!query) return;
  const cutoff = daysBefore(ukDay(now), HISTORY_DAYS + 30);
  await query(`DELETE FROM price_snapshots WHERE day < $1::date`, [cutoff]);
  await query(`DELETE FROM auction_closes WHERE day < $1::date`, [cutoff]);
}
