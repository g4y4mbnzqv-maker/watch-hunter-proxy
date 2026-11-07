import { dealProfit, isSold } from "./dealLog";

// Figures for the Home dashboard, worked out from what's already saved

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Profit and sales for each of the last few months, oldest first,
// including months with no sales
export function monthlyProfit(deals, settings, now = new Date(), months = 6) {
  const rows = [];
  for (let back = months - 1; back >= 0; back--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const key = date.toISOString().slice(0, 7);
    rows.push({ month: key, label: MONTH_NAMES[date.getUTCMonth()], profit: 0, sales: 0 });
  }
  const byMonth = new Map(rows.map((row) => [row.month, row]));
  for (const deal of deals) {
    if (!isSold(deal) || !deal.soldOn) continue;
    const row = byMonth.get(String(deal.soldOn).slice(0, 7));
    if (!row) continue;
    row.profit += dealProfit(deal, settings);
    row.sales += 1;
  }
  return rows.map((row) => ({ ...row, profit: Math.round(row.profit) }));
}

// The setup steps and whether each is done. sync is the sync status,
// alerts the deal alert status for this device, lastBackup a time or null.
// A scheduled job counts as working when it ran within these windows. The
// hourly alert check pauses overnight, so it gets 10 hours; the daily price
// run gets a day and a bit
const ALERT_CHECK_MS = 10 * 3_600_000;
const PRICE_RUN_MS = 30 * 3_600_000;

export function setupSteps({ sync, alerts, lastBackup, runs, now = Date.now() }) {
  const backupFresh = Boolean(lastBackup) && now - lastBackup < 30 * 86_400_000;
  const recent = (at, window) => Boolean(at) && now - at < window;
  return [
    { key: "database", label: "Database connected", done: sync !== "no-database" && sync !== "checking" },
    { key: "passcode", label: "Passcode set (APP_PASSCODE)", done: sync === "on" },
    { key: "alerts", label: "Deal alerts on for this device", done: alerts === "on" },
    {
      key: "alert-check",
      label: "Hourly alert check running (GitHub secrets APP_URL and CRON_SECRET)",
      done: recent(runs?.alerts, ALERT_CHECK_MS),
      last: runs?.alerts ?? null,
    },
    {
      key: "price-run",
      label: "Daily price run working (CRON_SECRET in Vercel)",
      done: recent(runs?.harvest, PRICE_RUN_MS),
      last: runs?.harvest ?? null,
    },
    { key: "backup", label: "Backup in the last 30 days", done: backupFresh },
  ];
}

// How far this month's profit is through your monthly goal: { percent,
// remaining, daysLeft, perDay }, or null with no goal. perDay is what the
// rest of the month needs each day, or 0 once the goal is met.
export function goalProgress(profit, goal, now = new Date()) {
  if (!(goal > 0)) return null;
  const date = new Date(now);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const daysLeft = Math.max(end.getDate() - date.getDate() + 1, 1);
  const remaining = Math.max(Math.round(goal - profit), 0);
  return {
    percent: Math.max(Math.min(Math.round((profit / goal) * 100), 100), 0),
    remaining,
    daysLeft,
    perDay: remaining ? Math.ceil(remaining / daysLeft) : 0,
  };
}
