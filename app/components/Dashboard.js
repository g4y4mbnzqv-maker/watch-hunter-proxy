"use client";

import { useEffect, useMemo, useState } from "react";
import { formatGbp, formatTimeLeft } from "./format";
import { monthlyProfit, setupSteps } from "@/lib/dashboard";
import { summarise } from "@/lib/dealLog";
import { stockReminders } from "@/lib/stock";
import { priceMovers } from "@/lib/review";
import { taxYearSummary } from "@/lib/tax";
import { cleanWanted } from "@/lib/wanted";
import { useSyncStatus } from "../client/sync";
import { useDealAlerts } from "../client/useDealAlerts";
import { lastBackupAt } from "../client/backup";

// Validated against the dark card surface, as in the price chart
const BAR = "#3987e5";
const SURFACE = "#18181b";
const GRID = "rgba(255,255,255,0.07)";

// Everything that matters on one screen, each part leading to its tab
export default function Dashboard({ deals, settings, watchItems, wanted, usage, models, scan, now, onNavigate }) {
  const sync = useSyncStatus();
  const alerts = useDealAlerts();
  const [lastBackup, setLastBackup] = useState(null);
  useEffect(() => setLastBackup(lastBackupAt()), []);

  const summary = useMemo(() => summarise(deals, settings), [deals, settings]);
  const months = useMemo(() => monthlyProfit(deals, settings), [deals, settings]);
  const tax = useMemo(() => taxYearSummary(deals, settings), [deals, settings]);
  const reminders = useMemo(() => stockReminders(deals, settings), [deals, settings]);
  const movers = useMemo(() => priceMovers(models, 3), [models]);
  const steps = setupSteps({ sync, alerts: alerts.status, lastBackup });
  const stepsLeft = steps.filter((step) => !step.done);

  const live = watchItems.filter((item) => !item.ended);
  const endingNext = live.filter((item) => item.listingType !== "BUY_IT_NOW").slice(0, 3);
  const wantedList = cleanWanted(wanted);
  const thisMonth = months[months.length - 1];

  return (
    <section className="space-y-4">
      {stepsLeft.length > 0 && (
        <Card title="Finish setting up" action="Open Settings" onAction={() => onNavigate("settings")}>
          <ul className="space-y-1.5 text-xs">
            {steps.map((step) => (
              <li key={step.key} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                    step.done ? "bg-emerald-400 text-emerald-950" : "ring-1 ring-zinc-600"
                  }`}
                >
                  {step.done ? "✓" : ""}
                </span>
                <span className={step.done ? "text-zinc-500 line-through" : "text-zinc-200"}>{step.label}</span>
                <span className="sr-only">{step.done ? "done" : "not done"}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Profit this month" value={formatGbp(thisMonth.profit)} note={`${thisMonth.sales} sold`} accent={thisMonth.profit > 0} onClick={() => onNavigate("deals")} />
        <Tile label="Profit this tax year" value={formatGbp(tax.profit)} note={`${tax.year.label}, ${tax.sales} sold`} onClick={() => onNavigate("deals")} />
        <Tile
          label="In stock"
          value={summary.inStock}
          note={summary.inStock ? `${formatGbp(summary.stockCost)} paid${reminders.length ? `, ${reminders.length} ${reminders.length === 1 ? "needs" : "need"} attention` : ""}` : "nothing unsold"}
          warn={reminders.length > 0}
          onClick={() => onNavigate("deals")}
        />
        <Tile
          label="eBay calls today"
          value={usage ? `${usage.used.toLocaleString("en-GB")}` : "–"}
          note={usage ? `of ${usage.limit.toLocaleString("en-GB")}` : "not available"}
          warn={usage && usage.used / usage.limit >= 0.8}
        />
      </div>

      <Card title="Profit by month" action="Sales" onAction={() => onNavigate("deals")}>
        {deals.some((deal) => deal.soldFor) ? (
          <ProfitBars months={months} />
        ) : (
          <p className="text-xs text-zinc-500">Log a sale in the Sales tab and your monthly profit shows here.</p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Ending next on your watchlist" action="Watchlist" onAction={() => onNavigate("watchlist")}>
          {endingNext.length ? (
            <ul className="space-y-2 text-xs">
              {endingNext.map((item) => (
                <li key={item.itemId} className="flex items-baseline gap-2">
                  <span className="w-14 shrink-0 tabular-nums text-rose-300">{formatTimeLeft(item.endTime, now)}</span>
                  <span className="min-w-0 flex-1 truncate text-zinc-200">{item.title}</span>
                  <span className="shrink-0 tabular-nums text-zinc-400">
                    {item.maxBid !== null ? `up to ${formatGbp(item.maxBid)}` : formatGbp(item.totalCost)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">No live auctions saved. Tap the bookmark on any card to follow it.</p>
          )}
          <p className="mt-3 text-xs text-zinc-500">
            {live.length} saved, {wantedList.length} on your wanted list.
          </p>
        </Card>

        <Card title="Last scan" action="Find deals" onAction={() => onNavigate("scan")}>
          {scan.brand ? (
            <div className="text-xs">
              <p className="text-zinc-200">
                {scan.brand}
                {scan.when ? `, ${scan.when}` : ""}
              </p>
              <p className="mt-1 text-zinc-400">
                {scan.count} listings, {scan.deals} {scan.deals === 1 ? "deal" : "deals"}
                {scan.best !== null && scan.best > 0 ? `, best profit ${formatGbp(scan.best)}` : ""}.
              </p>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">No scan yet. Find deals scans a brand, Top deals scans all your favourites.</p>
          )}
        </Card>
      </div>

      {(movers.rising.length > 0 || movers.falling.length > 0) && (
        <Card title="Price moves, last 30 days" action="Prices" onAction={() => onNavigate("index")}>
          <div className="grid gap-3 text-xs sm:grid-cols-2">
            <Movers label="Rising" rows={movers.rising} tone="text-emerald-300" symbol="▲" />
            <Movers label="Falling" rows={movers.falling} tone="text-rose-300" symbol="▼" />
          </div>
        </Card>
      )}

      <p className="flex items-center gap-2 text-xs text-zinc-500">
        <span className={`h-1.5 w-1.5 rounded-full ${sync === "on" ? "bg-emerald-400" : "bg-amber-400"}`} aria-hidden="true" />
        {sync === "on" ? "Syncing across your devices." : "Saved in this browser only."} Deal alerts are{" "}
        {alerts.status === "on" ? "on" : "off"} for this device.
      </p>
    </section>
  );
}

function Card({ title, action, onAction, children }) {
  return (
    <div className="rounded-2xl bg-zinc-900/60 p-4 ring-1 ring-white/5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-zinc-100">{title}</h2>
        {action && (
          <button type="button" onClick={onAction} className="text-xs font-medium text-emerald-300 hover:text-emerald-200">
            {action} →
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Tile({ label, value, note, accent, warn, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`rounded-2xl px-4 py-3.5 text-left ring-1 transition ${
        accent ? "bg-gradient-to-br from-emerald-400/15 to-teal-300/5 ring-emerald-400/25" : warn ? "bg-amber-400/10 ring-amber-400/25" : "bg-zinc-900/60 ring-white/5"
      } ${onClick ? "hover:ring-white/20" : ""}`}
    >
      <div className="text-[11px] font-medium uppercase tracking-widest text-zinc-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold tracking-tight tabular-nums ${accent ? "text-emerald-300" : "text-zinc-50"}`}>{value}</div>
      {note && <div className="mt-0.5 text-[11px] text-zinc-500">{note}</div>}
    </Tag>
  );
}

function Movers({ label, rows, tone, symbol }) {
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-widest text-zinc-500">{label}</div>
      {rows.length ? (
        <ul className="space-y-1">
          {rows.map((model) => (
            <li key={`${model.modelKey}|${model.condition}`} className="flex justify-between gap-2">
              <span className="min-w-0 truncate text-zinc-200">{model.label}</span>
              <span className={`shrink-0 tabular-nums ${tone}`}>
                {symbol} {Math.abs(model.change.percent)}%
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-zinc-500">None by 5% or more.</p>
      )}
    </div>
  );
}

// One bar per month from a zero line, losses below it. Each bar can be
// focused or hovered for its figures, and a table carries the same data.
function ProfitBars({ months }) {
  const [active, setActive] = useState(null);
  const width = 600;
  const height = 160;
  const pad = { top: 12, bottom: 8, left: 8, right: 8 };
  const values = months.map((month) => month.profit);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const plot = height - pad.top - pad.bottom;
  const y = (value) => pad.top + ((max - value) / span) * plot;
  const slot = (width - pad.left - pad.right) / months.length;
  const barWidth = Math.min(slot * 0.56, 48);
  const shown = active === null ? months[months.length - 1] : months[active];

  return (
    <div>
      <p className="mb-2 text-xs text-zinc-400" aria-live="polite">
        {shown.label}: <span className="font-semibold tabular-nums text-zinc-100">{formatGbp(shown.profit)}</span> from{" "}
        {shown.sales} {shown.sales === 1 ? "sale" : "sales"}
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-36 w-full" role="img" aria-label="Profit by month for the last six months">
        <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} stroke={GRID} strokeWidth="1" />
        {months.map((month, index) => {
          const x = pad.left + slot * index + (slot - barWidth) / 2;
          const top = Math.min(y(month.profit), y(0));
          const barHeight = Math.max(Math.abs(y(month.profit) - y(0)), month.profit ? 2 : 0);
          return (
            <g key={month.month}>
              <rect
                x={x}
                y={top}
                width={barWidth}
                height={barHeight}
                rx="4"
                fill={BAR}
                opacity={active === null || active === index ? 1 : 0.45}
                stroke={SURFACE}
                strokeWidth="2"
              />
              {/* A wider, invisible target than the bar itself */}
              <rect
                x={pad.left + slot * index}
                y={pad.top}
                width={slot}
                height={plot}
                fill="transparent"
                tabIndex={0}
                aria-label={`${month.label}: ${formatGbp(month.profit)} profit from ${month.sales} sales`}
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                className="cursor-default outline-none"
              />
            </g>
          );
        })}
      </svg>
      {/* Labels outside the chart, so they stay readable when it shrinks to a phone */}
      <div className="mt-1 flex" aria-hidden="true">
        {months.map((month, index) => (
          <span key={month.month} className={`flex-1 text-center text-[11px] ${active === index ? "text-zinc-200" : "text-zinc-500"}`}>
            {month.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Profit by month</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>Profit</th>
            <th>Sales</th>
          </tr>
        </thead>
        <tbody>
          {months.map((month) => (
            <tr key={month.month}>
              <td>{month.label}</td>
              <td>{formatGbp(month.profit)}</td>
              <td>{month.sales}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
