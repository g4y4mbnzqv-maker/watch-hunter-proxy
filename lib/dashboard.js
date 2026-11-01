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
export function setupSteps({ sync, alerts, lastBackup, now = Date.now() }) {
  const backupFresh = Boolean(lastBackup) && now - lastBackup < 30 * 86_400_000;
  return [
    { key: "database", label: "Database connected", done: sync !== "no-database" && sync !== "checking" },
    { key: "passcode", label: "Passcode set (APP_PASSCODE)", done: sync === "on" },
    { key: "alerts", label: "Deal alerts on for this device", done: alerts === "on" },
    { key: "backup", label: "Backup in the last 30 days", done: backupFresh },
  ];
}
