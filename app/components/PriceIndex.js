"use client";

import { useEffect, useMemo, useState } from "react";
import PriceChart from "./PriceChart";
import { EmptyState, Notice, Stat } from "./Placeholders";
import { formatGbp } from "./format";

const CONDITION_LABELS = { USED: "Pre-owned", NEW: "New", ANY: "Any condition" };

const SORTS = [
  { key: "rising", label: "Biggest risers", compare: (a, b) => (b.change?.percent ?? -Infinity) - (a.change?.percent ?? -Infinity) },
  { key: "falling", label: "Biggest fallers", compare: (a, b) => (a.change?.percent ?? Infinity) - (b.change?.percent ?? Infinity) },
  { key: "listings", label: "Most listings", compare: (a, b) => b.listings - a.listings },
  { key: "recent", label: "Recently updated", compare: (a, b) => b.day.localeCompare(a.day) },
  { key: "name", label: "A to Z", compare: (a, b) => a.label.localeCompare(b.label) },
];

const RANGES = [
  { key: 30, label: "30 days" },
  { key: 90, label: "90 days" },
  { key: 365, label: "1 year" },
];

// The price index: every model the app has seen, with how its asking prices
// and auction closes have moved
export default function PriceIndex() {
  const [state, setState] = useState({ loading: true });
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("rising");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/index")
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => {
        if (cancelled) return;
        if (!res.ok || data.error) setState({ error: data.message || `Couldn't load prices (${res.status})` });
        else setState({ enabled: data.enabled, models: data.models });
      })
      .catch((err) => !cancelled && setState({ error: err.message }));
    return () => {
      cancelled = true;
    };
  }, []);

  const models = useMemo(() => {
    if (!state.models) return [];
    const text = filter.trim().toLowerCase();
    return state.models
      .filter((model) => !text || `${model.label} ${model.brand ?? ""}`.toLowerCase().includes(text))
      .sort(SORTS.find((option) => option.key === sort).compare);
  }, [state.models, filter, sort]);

  if (state.loading) return <p className="text-sm text-zinc-400">Loading the price index…</p>;
  if (state.error) return <Notice tone="rose">{state.error}</Notice>;
  if (!state.enabled) return <SetupSteps />;

  if (selected) {
    return <ModelDetail model={selected} onBack={() => setSelected(null)} />;
  }

  if (!state.models.length) {
    return (
      <EmptyState
        title="No prices recorded yet."
        body="Every scan adds its prices here, and the daily run adds the popular brands each morning. Run a scan to get started."
      />
    );
  }

  return (
    <section>
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-white">Price index</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Median UK asking prices by model, recorded from your scans and a daily run, with auction
          bids from the last hour before they close.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by model or brand"
          className="min-w-0 flex-1 rounded-full bg-black/30 px-4 py-2 text-sm text-zinc-100 outline-none ring-1 ring-white/10 placeholder:text-zinc-500 focus:ring-emerald-400/60"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-full bg-zinc-900/80 px-3.5 py-2 text-sm text-zinc-200 outline-none ring-1 ring-white/10"
        >
          {SORTS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <p className="mb-2 text-xs text-zinc-500">
        {models.length} of {state.models.length} tracked
      </p>

      <ul className="divide-y divide-white/5 overflow-hidden rounded-3xl bg-zinc-900/60 ring-1 ring-white/5">
        {models.map((model) => (
          <li key={`${model.modelKey}|${model.condition}`}>
            <button
              type="button"
              onClick={() => setSelected(model)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-zinc-50">{model.label}</div>
                <div className="mt-0.5 truncate text-xs text-zinc-500">
                  {[model.brand, CONDITION_LABELS[model.condition], `${model.listings} listings`]
                    .filter(Boolean)
                    .join(" · ")}
                  {model.closes && ` · ${model.closes.count} auction ${model.closes.count === 1 ? "close" : "closes"}`}
                </div>
              </div>
              <Sparkline points={model.spark} />
              <div className="w-24 shrink-0 text-right">
                <div className="text-sm font-semibold tabular-nums text-zinc-50">{formatGbp(model.median)}</div>
                <Change change={model.change} />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Change({ change }) {
  if (!change) return <div className="text-[11px] text-zinc-500">new</div>;
  const up = change.percent > 0;
  const flat = change.percent === 0;
  return (
    <div
      className={`text-[11px] tabular-nums ${flat ? "text-zinc-400" : up ? "text-emerald-300" : "text-rose-300"}`}
      title={`Since ${change.since}`}
    >
      <span aria-hidden="true">{flat ? "■" : up ? "▲" : "▼"}</span> {Math.abs(change.percent)}%
      <span className="sr-only">{flat ? " unchanged" : up ? " up" : " down"} since {change.since}</span>
    </div>
  );
}

// A small trend line of recent medians
function Sparkline({ points }) {
  if (points.length < 2) return <div className="hidden w-24 shrink-0 sm:block" />;
  const values = points.map((point) => point.median);
  const [min, max] = [Math.min(...values), Math.max(...values)];
  const x = (index) => 2 + (index / (points.length - 1)) * 92;
  const y = (value) => (max === min ? 14 : 24 - ((value - min) / (max - min)) * 20);
  const path = values.map((value, index) => `${index ? "L" : "M"}${x(index)},${y(value)}`).join("");
  return (
    <svg width="96" height="28" className="hidden shrink-0 sm:block" aria-hidden="true">
      <path d={path} fill="none" stroke="#3987e5" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="2.5" fill="#3987e5" />
    </svg>
  );
}

function ModelDetail({ model, onBack }) {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(null);
  const [range, setRange] = useState(90);
  const [condition, setCondition] = useState(model.condition);

  useEffect(() => {
    fetch(`/api/index/model?${new URLSearchParams({ key: model.modelKey })}`)
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => {
        if (!res.ok || data.error) setError(data.message || `Couldn't load history (${res.status})`);
        else setHistory(data);
      })
      .catch((err) => setError(err.message));
  }, [model.modelKey]);

  const view = useMemo(() => {
    if (!history) return null;
    const from = new Date(Date.now() - range * 86_400_000).toISOString().slice(0, 10);
    const asking = history.asking.filter((point) => point.condition === condition && point.day >= from);
    const closes = history.closes.filter((point) => point.day >= from);
    const conditions = [...new Set(history.asking.map((point) => point.condition))];
    return { asking, closes, conditions };
  }, [history, range, condition]);

  const latest = view?.asking[view.asking.length - 1];
  const first = view?.asking[0];
  const change =
    latest && first && latest.day !== first.day
      ? Math.round(((latest.median - first.median) / first.median) * 1000) / 10
      : null;
  const closeCount = view?.closes.reduce((total, point) => total + point.count, 0) ?? 0;

  return (
    <section>
      <button type="button" onClick={onBack} className="mb-4 text-sm text-zinc-400 hover:text-zinc-100">
        ← All models
      </button>
      <h1 className="text-2xl font-bold tracking-tight text-white">{model.label}</h1>
      <p className="mt-1 text-sm text-zinc-400">{model.brand ?? "Watch"} price history</p>

      {error && <Notice tone="rose">{error}</Notice>}
      {!history && !error && <p className="mt-6 text-sm text-zinc-400">Loading history…</p>}

      {view && (
        <>
          <div className="my-5 flex flex-wrap items-center gap-2">
            {RANGES.map((option) => (
              <Pill key={option.key} active={range === option.key} onClick={() => setRange(option.key)}>
                {option.label}
              </Pill>
            ))}
            {view.conditions.length > 1 && <span className="mx-1 h-5 w-px bg-white/10" />}
            {view.conditions.length > 1 &&
              view.conditions.map((option) => (
                <Pill key={option} active={condition === option} onClick={() => setCondition(option)}>
                  {CONDITION_LABELS[option]}
                </Pill>
              ))}
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Latest asking median" value={formatGbp(latest?.median)} />
            <Stat
              label={`Change over ${RANGES.find((option) => option.key === range).label}`}
              value={change === null ? "–" : `${change > 0 ? "+" : ""}${change}%`}
            />
            <Stat label="Auction closes" value={closeCount} />
            <Stat
              label="Close median"
              value={closeCount ? formatGbp(median(view.closes.map((point) => point.median))) : "–"}
            />
          </div>

          {view.asking.length || view.closes.length ? (
            <div className="rounded-3xl bg-zinc-900/60 p-4 ring-1 ring-white/5 sm:p-5">
              <PriceChart asking={view.asking} closes={view.closes} />
            </div>
          ) : (
            <EmptyState title="No prices in this range yet." body="Try a longer range, or check back after more scans." />
          )}

          {view.asking.length > 0 && <HistoryTable asking={view.asking} closes={view.closes} />}
        </>
      )}
    </section>
  );
}

// The chart's figures as a table, newest first
function HistoryTable({ asking, closes }) {
  const closesBy = new Map(closes.map((point) => [point.day, point]));
  const rows = [...asking].reverse().slice(0, 30);
  return (
    <div className="mt-5 overflow-x-auto rounded-3xl bg-zinc-900/60 ring-1 ring-white/5">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Daily prices, newest first</caption>
        <thead className="text-[11px] uppercase tracking-widest text-zinc-500">
          <tr>
            <th className="px-4 py-3 font-medium">Day</th>
            <th className="px-4 py-3 text-right font-medium">Asking median</th>
            <th className="px-4 py-3 text-right font-medium">Range</th>
            <th className="px-4 py-3 text-right font-medium">Listings</th>
            <th className="px-4 py-3 text-right font-medium">Closes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 tabular-nums text-zinc-200">
          {rows.map((row) => {
            const close = closesBy.get(row.day);
            return (
              <tr key={row.day}>
                <td className="px-4 py-2.5">
                  {new Date(`${row.day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </td>
                <td className="px-4 py-2.5 text-right">{formatGbp(row.median)}</td>
                <td className="px-4 py-2.5 text-right text-zinc-400">
                  {formatGbp(row.low)} to {formatGbp(row.high)}
                </td>
                <td className="px-4 py-2.5 text-right text-zinc-400">{row.listings}</td>
                <td className="px-4 py-2.5 text-right text-zinc-400">
                  {close ? `${formatGbp(close.median)} (${close.count})` : "–"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition ${
        active ? "bg-white text-zinc-950 ring-white" : "text-zinc-400 ring-white/10 hover:text-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}

function SetupSteps() {
  return (
    <section className="rounded-3xl bg-zinc-900/60 p-6 ring-1 ring-white/5">
      <h1 className="text-xl font-bold tracking-tight text-white">Set up the price index</h1>
      <p className="mt-1 text-sm text-zinc-400">
        The price index keeps history in a small database. Neon's free plan is enough.
      </p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-zinc-300">
        <li>In your Vercel project, open Storage, choose Create Database, then Neon (Postgres).</li>
        <li>Connect it to this project. Vercel adds DATABASE_URL for you.</li>
        <li>
          Under Settings, Environment Variables, add CRON_SECRET with any long random text. This
          lets the daily run start, and nobody else.
        </li>
        <li>Redeploy. Prices start recording from your next scan.</li>
      </ol>
    </section>
  );
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
