"use client";

import { useEffect, useMemo, useState } from "react";
import AuctionCard from "./components/AuctionCard";
import SettingsPanel from "./components/SettingsPanel";
import { formatGbp, hoursLeft } from "./components/format";
import { analyse, DEFAULT_SETTINGS } from "@/lib/profit";
import { assessSeller } from "@/lib/seller";

const QUICK_BRANDS = ["Seiko", "Citizen", "Orient", "Tissot", "Hamilton", "Casio", "Omega"];

const VIEWS = [
  { key: "deals", label: "Deals" },
  { key: "soon", label: "Ending in 6h" },
  { key: "all", label: "Everything" },
];

const SORTS = [
  { key: "ending", label: "Ending soonest" },
  { key: "profit", label: "Highest profit" },
  { key: "headroom", label: "Most headroom" },
  { key: "roi", label: "Best return" },
];

export default function Home() {
  const [brand, setBrand] = useState("Seiko");
  const [includeJunk, setIncludeJunk] = useState(false);
  const [results, setResults] = useState([]);
  const [scannedBrand, setScannedBrand] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useStoredState("wh-settings", DEFAULT_SETTINGS);
  const [overrides, setOverrides] = useStoredState("wh-resale-overrides", {});
  const [hideRisky, setHideRisky] = useStoredState("wh-hide-risky", true);
  const [showSettings, setShowSettings] = useState(false);
  const [view, setView] = useState("deals");
  const [sort, setSort] = useState("ending");
  const now = useNow(30_000);

  async function scan(searchBrand = brand) {
    const query = searchBrand.trim();
    if (!query) return;

    setBrand(query);
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ brand: query });
      if (includeJunk) params.set("includeJunk", "1");

      const res = await fetch(`/api/scan?${params}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.message || `Scan failed (${res.status})`);
      }

      setResults(data.results);
      setScannedBrand(query);
    } catch (err) {
      console.error(err);
      setError(err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function setResale(itemId, value) {
    setOverrides((current) => {
      const next = { ...current };
      if (value === undefined) delete next[itemId];
      else next[itemId] = value;
      return next;
    });
  }

  const live = useMemo(() => {
    const merged = { ...DEFAULT_SETTINGS, ...settings };

    return results
      .map((item) => ({
        ...analyse(item, merged, overrides[item.itemId]),
        sellerCheck: assessSeller(item.seller, merged),
      }))
      .filter((item) => hoursLeft(item.endTime, now) > 0);
  }, [results, settings, overrides, now]);

  const riskyCount = live.filter((item) => item.sellerCheck.level === "risky").length;

  const analysed = useMemo(
    () =>
      hideRisky ? live.filter((item) => item.sellerCheck.level !== "risky") : live,
    [live, hideRisky]
  );

  const visible = useMemo(() => {
    const filtered = analysed.filter((item) => {
      if (view === "deals") return item.status === "deal";
      if (view === "soon") return hoursLeft(item.endTime, now) < 6;
      return true;
    });

    return [...filtered].sort(SORTERS[sort]);
  }, [analysed, view, sort, now]);

  const stats = useMemo(() => {
    const priced = analysed.filter((item) => item.profit !== null);
    const deals = analysed.filter((item) => item.status === "deal");
    const best = priced.reduce(
      (top, item) => (top === null || item.profit > top.profit ? item : top),
      null
    );

    return {
      scanned: analysed.length,
      priced: priced.length,
      deals: deals.length,
      best: best?.profit ?? null,
    };
  }, [analysed]);

  const counts = {
    deals: stats.deals,
    soon: analysed.filter((item) => hoursLeft(item.endTime, now) < 6).length,
    all: analysed.length,
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Watch Hunter
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            eBay UK watch auctions you can resell at a profit
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowSettings((open) => !open)}
          className={`rounded-xl px-4 py-2 text-sm ring-1 transition ${
            showSettings
              ? "bg-zinc-100 text-zinc-950 ring-zinc-100"
              : "text-zinc-300 ring-zinc-700 hover:ring-zinc-500"
          }`}
        >
          Settings
        </button>
      </header>

      <section className="mb-6 rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800 sm:p-5">
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            scan();
          }}
        >
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-zinc-100 outline-none ring-1 ring-zinc-700 placeholder:text-zinc-500 focus:ring-emerald-500"
            placeholder="Brand or model, such as Seiko SKX007"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-emerald-500 px-6 py-3 font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? "Scanning…" : "Find deals"}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {QUICK_BRANDS.map((name) => (
            <button
              key={name}
              type="button"
              disabled={loading}
              onClick={() => scan(name)}
              className={`rounded-full px-3 py-1 text-xs ring-1 transition ${
                scannedBrand?.toLowerCase() === name.toLowerCase()
                  ? "bg-zinc-100 text-zinc-950 ring-zinc-100"
                  : "text-zinc-300 ring-zinc-700 hover:ring-zinc-500"
              }`}
            >
              {name}
            </button>
          ))}

          <label className="ml-auto flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={includeJunk}
              onChange={(e) => setIncludeJunk(e.target.checked)}
              className="accent-emerald-500"
            />
            Include parts and repairs
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={hideRisky}
              onChange={(e) => setHideRisky(e.target.checked)}
              className="accent-emerald-500"
            />
            Hide risky sellers
          </label>
        </div>
      </section>

      {showSettings && (
        <div className="mb-6">
          <SettingsPanel
            settings={{ ...DEFAULT_SETTINGS, ...settings }}
            onChange={setSettings}
          />
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-2xl bg-rose-950/40 p-4 text-sm text-rose-200 ring-1 ring-rose-500/40">
          {error}
        </div>
      )}

      {loading && <LoadingGrid />}

      {!loading && scannedBrand && !error && (
        <>
          <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Auctions found"
              value={stats.scanned}
              note={
                hideRisky && riskyCount > 0
                  ? `${riskyCount} from risky sellers hidden`
                  : null
              }
            />
            <Stat
              label="With a resale estimate"
              value={stats.priced}
            />
            <Stat
              label={`Clearing ${formatGbp(settings.minProfit ?? DEFAULT_SETTINGS.minProfit)}`}
              value={stats.deals}
              accent={stats.deals > 0}
            />
            <Stat
              label="Best profit at current bid"
              value={formatGbp(stats.best)}
              accent={stats.best !== null && stats.best > 0}
            />
          </section>

          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-xl bg-zinc-900 p-1 ring-1 ring-zinc-800">
              {VIEWS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setView(option.key)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    view === option.key
                      ? "bg-zinc-100 text-zinc-950"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {option.label}
                  <span className="ml-1.5 tabular-nums opacity-60">
                    {counts[option.key]}
                  </span>
                </button>
              ))}
            </div>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-xl bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none ring-1 ring-zinc-800"
            >
              {SORTS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {visible.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((item) => (
                <AuctionCard
                  key={item.itemId}
                  item={item}
                  now={now}
                  onSetResale={setResale}
                />
              ))}
            </div>
          ) : (
            <EmptyView view={view} onShowAll={() => setView("all")} />
          )}
        </>
      )}

      {!loading && !scannedBrand && !error && <Intro />}
    </main>
  );
}

const SORTERS = {
  profit: (a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity),
  roi: (a, b) => (b.roi ?? -Infinity) - (a.roi ?? -Infinity),
  headroom: (a, b) =>
    (b.maxBid === null ? -Infinity : b.maxBid - b.currentBid) -
    (a.maxBid === null ? -Infinity : a.maxBid - a.currentBid),
  ending: (a, b) => new Date(a.endTime) - new Date(b.endTime),
};

function Stat({ label, value, note, accent = false }) {
  return (
    <div className="rounded-2xl bg-zinc-900 px-4 py-3 ring-1 ring-zinc-800">
      <div className="text-xs text-zinc-400">{label}</div>
      <div
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          accent ? "text-emerald-400" : "text-zinc-100"
        }`}
      >
        {value}
      </div>
      {note && <div className="mt-0.5 text-[11px] text-zinc-500">{note}</div>}
    </div>
  );
}

function EmptyView({ view, onShowAll }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 px-6 py-12 text-center">
      <p className="text-sm text-zinc-300">
        {view === "deals"
          ? "Nothing clears your target profit right now."
          : "No auctions match this view."}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        {view === "deals"
          ? "Try another brand, lower the target in Settings, or add your own resale values."
          : "Try another brand or view."}
      </p>
      {view !== "all" && (
        <button
          type="button"
          onClick={onShowAll}
          className="mt-4 rounded-xl px-4 py-2 text-sm text-zinc-200 ring-1 ring-zinc-700 hover:ring-zinc-500"
        >
          Show everything
        </button>
      )}
    </div>
  );
}

function Intro() {
  const steps = [
    {
      title: "Scan a brand",
      body: "Pulls live eBay UK auctions, ending soonest first, with parts and accessories filtered out.",
    },
    {
      title: "Estimate resale",
      body: "Looks up current Buy It Now prices for the same model reference and takes the median.",
    },
    {
      title: "Bid to your limit",
      body: "Each card shows profit after fees and postage, and the most you can bid to still hit your target.",
    },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-3">
      {steps.map((step, index) => (
        <div
          key={step.title}
          className="rounded-2xl bg-zinc-900 p-5 ring-1 ring-zinc-800"
        >
          <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-medium text-emerald-400">
            {index + 1}
          </div>
          <h2 className="text-sm font-medium text-zinc-100">{step.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">
            {step.body}
          </p>
        </div>
      ))}
    </section>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="animate-pulse overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-zinc-800"
        >
          <div className="aspect-[16/10] bg-zinc-800 sm:aspect-[4/3]" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-4/5 rounded bg-zinc-800" />
            <div className="h-3 w-2/5 rounded bg-zinc-800" />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-14 rounded-xl bg-zinc-800" />
              <div className="h-14 rounded-xl bg-zinc-800" />
              <div className="h-14 rounded-xl bg-zinc-800" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Re-renders on an interval so countdowns stay current
function useNow(intervalMs) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

// useState that remembers its value in this browser
function useStoredState(key, initial) {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) setValue(JSON.parse(stored));
    } catch {
      // Storage blocked or corrupt: keep the default
    }
  }, [key]);

  function update(next) {
    setValue((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // Storage blocked: the value still applies for this visit
      }
      return resolved;
    });
  }

  return [value, update];
}
