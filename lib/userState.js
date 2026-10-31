import { getQuery, withSchema } from "./db";

// Your watchlist, settings, sales log and other saved choices, kept in the
// database so every device sees the same. Each is stored whole under its
// key with the time it last changed, and the newest change wins.

// Keys the app may store, so the table can't be filled with anything else
export const SYNCED_KEYS = [
  "wh-settings",
  "wh-resale-overrides",
  "wh-model-values",
  "wh-hide-risky",
  "wh-guaranteed-only",
  "wh-grades",
  "wh-types",
  "wh-top-brands",
  "wh-watchlist",
  "wh-deals",
  "wh-skipped",
];

// Plenty for years of watchlist and sales; stops a runaway save
export const MAX_VALUE_BYTES = 1_000_000;

const db = withSchema(async (query) => {
  await query(`
    CREATE TABLE IF NOT EXISTS user_state (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      changed_at bigint NOT NULL
    )`);
});

// Syncing needs a database, and a passcode so strangers can't read or
// change your data. Returns null when both are there, or the reason not.
export function syncUnavailable() {
  if (!getQuery()) return "no-database";
  if (!process.env.APP_PASSCODE) return "no-passcode";
  return null;
}

// Every stored key as { [key]: { value, changedAt } }
export async function readState() {
  const query = await db();
  const rows = await query(`SELECT key, value, changed_at FROM user_state`);
  return Object.fromEntries(rows.map((row) => [row.key, { value: row.value, changedAt: Number(row.changed_at) }]));
}

// Saves a value if it is newer than what's stored. Returns what's stored
// afterwards, so a device holding an older copy learns the newer one.
export async function writeState(key, value, changedAt) {
  const query = await db();
  const rows = await query(
    `INSERT INTO user_state (key, value, changed_at) VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, changed_at = EXCLUDED.changed_at
       WHERE user_state.changed_at < EXCLUDED.changed_at
     RETURNING key`,
    [key, JSON.stringify(value), changedAt]
  );
  if (rows.length) return { value, changedAt, saved: true };
  const [current] = await query(`SELECT value, changed_at FROM user_state WHERE key = $1`, [key]);
  return { value: current.value, changedAt: Number(current.changed_at), saved: false };
}
