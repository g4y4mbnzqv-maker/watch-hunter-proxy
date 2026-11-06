import { withSchema } from "./db";

// When each scheduled job last ran, so the Home tab can show whether the
// hourly alert check (GitHub Actions) and the daily price run (Vercel Cron)
// are really running.

const db = withSchema(async (query) => {
  await query(`CREATE TABLE IF NOT EXISTS run_log (name text PRIMARY KEY, ran_at timestamptz NOT NULL)`);
});

// Records a run. A failure here never stops the job itself.
export async function noteRun(name, now = new Date()) {
  try {
    const query = await db();
    if (!query) return;
    await query(
      `INSERT INTO run_log (name, ran_at) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET ran_at = EXCLUDED.ran_at`,
      [name, now.toISOString()]
    );
  } catch (err) {
    console.error("Couldn't note the run:", err.message);
  }
}

// { alerts, harvest }: when each last ran, as milliseconds, or null.
// Returns null with no database.
export async function lastRuns() {
  const query = await db();
  if (!query) return null;
  const rows = await query(`SELECT name, ran_at FROM run_log`);
  const at = Object.fromEntries(rows.map((row) => [row.name, new Date(row.ran_at).getTime()]));
  return { alerts: at.alerts ?? null, harvest: at.harvest ?? null };
}
