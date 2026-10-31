import { withSchema } from "./db";

// Comparable Buy It Now listings for each model, saved in the database so
// every scan, alert check and daily run shares them. Without this each new
// server instance looks the same models up on eBay again. Saving and
// reading never hold up a scan: a slow or missing database is skipped.

// Asking prices move slowly, so a lookup is good for this long
export const COMPS_STORE_MS = 6 * 60 * 60_000;
// Give up on the database after this long and ask eBay instead
const STORE_TIMEOUT_MS = 1_500;

const db = withSchema(async (query) => {
  await query(`
    CREATE TABLE IF NOT EXISTS comps_cache (
      key text PRIMARY KEY,
      listings jsonb NOT NULL,
      fetched_at timestamptz NOT NULL DEFAULT now()
    )`);
});

function withinTime(promise) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), STORE_TIMEOUT_MS))]);
}

// The saved listings for a key and when they were fetched, or null when
// there are none fresh enough or no database
export async function readComps(key, now = Date.now()) {
  try {
    return await withinTime(
      (async () => {
        const query = await db();
        if (!query) return null;
        const [row] = await query(`SELECT listings, fetched_at FROM comps_cache WHERE key = $1`, [key]);
        if (!row) return null;
        const fetchedAt = new Date(row.fetched_at).getTime();
        return now - fetchedAt < COMPS_STORE_MS ? { listings: row.listings, fetchedAt } : null;
      })()
    );
  } catch (err) {
    console.error("Couldn't read saved prices:", err.message);
    return null;
  }
}

export async function saveComps(key, listings) {
  try {
    await withinTime(
      (async () => {
        const query = await db();
        if (!query) return;
        await query(
          `INSERT INTO comps_cache (key, listings, fetched_at) VALUES ($1, $2::jsonb, now())
           ON CONFLICT (key) DO UPDATE SET listings = EXCLUDED.listings, fetched_at = EXCLUDED.fetched_at`,
          [key, JSON.stringify(listings)]
        );
      })()
    );
  } catch (err) {
    console.error("Couldn't save prices:", err.message);
  }
}

// Clears out lookups older than a day, from the daily run
export async function pruneComps() {
  try {
    const query = await db();
    if (query) await query(`DELETE FROM comps_cache WHERE fetched_at < now() - interval '1 day'`);
  } catch (err) {
    console.error("Couldn't prune saved prices:", err.message);
  }
}
