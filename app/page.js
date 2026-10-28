"use client";

import { useEffect, useMemo, useState } from "react";
import AuctionCard from "./components/AuctionCard";
import SettingsPanel from "./components/SettingsPanel";
import BrandPicker, { POPULAR } from "./components/BrandPicker";
import UsageMeter from "./components/UsageMeter";
import EndingSoon from "./components/EndingSoon";
import ConditionFilter from "./components/ConditionFilter";
import ScanExplainer from "./components/ScanExplainer";
import ListingTypeFilter, { LISTING_TYPES } from "./components/ListingTypeFilter";
import { formatGbp, formatTimeLeft, hoursLeft } from "./components/format";
import { analyse, DEFAULT_SETTINGS } from "@/lib/profit";
import { assessSeller } from "@/lib/seller";
import { modelKey } from "@/lib/models";
import { GRADES, conditionGrade } from "@/lib/condition";


const VIEWS = [
  { key: "deals", label: "Deals" },
  { key: "soon", label: "Ending in 6h" },
  { key: "bin", label: "Buy It Now" },
  { key: "all", label: "Everything" },
];

// Listing fields kept for each saved auction, so the watchlist shows
// without a scan and survives the listing ending
const SNAPSHOT_FIELDS = [
  "itemId", "title", "url", "image", "condition", "modelRef", "currentBid",
  "postage", "totalCost", "bidCount", "endTime", "seller", "comps", "brand",
  "conditionId", "images", "listingType", "bestOffer", "modelName",
];

// Label used in place of a brand once a Top deals scan has run
const TOP_DEALS = "Top deals";
// Brands scanned at once by Top deals, to stay gentle on the eBay API
const TOP_DEALS_CONCURRENCY = 3;

// Saved auctions with this many minutes left go in the ending-soon banner
// and, if alerts are on, trigger a notification
const ENDING_SOON_MINUTES = 10;

const ALL_GRADES = GRADES.map((option) => option.key);
const GOOD_OR_BETTER = ["new", "excellent", "good"];

// Opening the watchlist refreshes it if the last refresh is older than this
const WATCHLIST_STALE_MS = 60_000;

const ALL_LISTING_TYPES = LISTING_TYPES.map((option) => option.key);

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
  // What eBay returned for the last single-brand scan, to explain empty ones
  const [scanStats, setScanStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useStoredState("wh-settings", DEFAULT_SETTINGS);
  // Resale values typed for one listing, by item ID
  const [overrides, setOverrides] = useStoredState("wh-resale-overrides", {});
  // Resale values typed for a model, by base reference such as SRPD55
  const [modelValues, setModelValues] = useStoredState("wh-model-values", {});
  const [hideRisky, setHideRisky] = useStoredState("wh-hide-risky", true);
  // Condition grades to show; every grade by default
  const [grades, setGrades] = useStoredState("wh-grades", ALL_GRADES);
  // Auctions, Buy It Now or both; both by default
  const [listingTypes, setListingTypes] = useStoredState("wh-types", ALL_LISTING_TYPES);
  const [watchlist, setWatchlist] = useStoredState("wh-watchlist", {});
  const [mode, setMode] = useState("scan");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);
  const [refreshedAt, setRefreshedAt] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [topProgress, setTopProgress] = useState(null);
  const [topFailures, setTopFailures] = useState([]);
  const [view, setView] = useState("deals");
  const [sort, setSort] = useState("ending");
  const [usage, setUsage] = useState(null);
  const [alertsOn, setAlertsOn] = useStoredState("wh-alerts", false);
  // Item IDs already notified, so each auction alerts once
  const [alerted, setAlerted] = useStoredState("wh-alerted", {});
  const [alertNote, setAlertNote] = useState(null);
  const now = useNow(30_000);

  // The meter is a nice-to-have, so any failure just hides it
  async function refreshUsage() {
    try {
      const res = await fetch("/api/usage");
      const data = await res.json();
      setUsage(res.ok && !data.error ? data.usage : null);
    } catch {
      setUsage(null);
    }
  }

  useEffect(() => {
    refreshUsage();
    // Phones need a service worker to show notifications
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  async function enableAlerts() {
    if (!("Notification" in window)) {
      setAlertNote(
        "This browser can't show alerts. Auctions ending soon will still appear at the top of the page."
      );
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setAlertsOn(true);
      setAlertNote(null);
    } else {
      setAlertNote(
        "Notifications are blocked for this site. Allow them in your browser settings to get alerts."
      );
    }
  }

  async function fetchBrand(query) {
    const params = new URLSearchParams({ brand: query, types: listingTypes.join(",") });
    if (includeJunk) params.set("includeJunk", "1");

    const res = await fetch(`/api/scan?${params}`);
    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.message || `Scan failed (${res.status})`);
    }

    return data;
  }

  async function scan(searchBrand = brand) {
    const query = searchBrand.trim();
    if (!query) return;

    setBrand(query);
    setLoading(true);
    setError(null);
    setTopFailures([]);

    try {
      const data = await fetchBrand(query);
      setResults(data.results);
      setScanStats(data.stats ?? null);
      refreshUsage();
      setScannedBrand(query);
    } catch (err) {
      console.error(err);
      setError(err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  // Scans every popular brand and combines the results, best profit first
  async function scanTopDeals() {
    setLoading(true);
    setError(null);
    setTopFailures([]);
    setTopProgress({ done: 0, total: POPULAR.length });

    const combined = new Map();
    const failures = [];
    let done = 0;

    for (let i = 0; i < POPULAR.length; i += TOP_DEALS_CONCURRENCY) {
      const batch = POPULAR.slice(i, i + TOP_DEALS_CONCURRENCY);

      await Promise.all(
        batch.map(async (name) => {
          try {
            for (const item of (await fetchBrand(name)).results) {
              // A listing can match two brands, such as Seiko and Grand Seiko
              if (!combined.has(item.itemId)) {
                combined.set(item.itemId, { ...item, brand: name });
              }
            }
          } catch (err) {
            console.error(err);
            failures.push({ name, message: err.message });
          } finally {
            done += 1;
            setTopProgress({ done, total: POPULAR.length });
          }
        })
      );
    }

    if (failures.length === POPULAR.length) {
      setError(failures[0].message);
      setResults([]);
    } else {
      setResults([...combined.values()]);
      setScannedBrand(TOP_DEALS);
      setScanStats(null);
      setTopFailures(failures.map((failure) => failure.name));
      setView("deals");
      setSort("profit");
    }

    setTopProgress(null);
    refreshUsage();
    setLoading(false);
  }

  function toggleSave(item) {
    setWatchlist((current) => {
      const next = { ...current };
      if (next[item.itemId]) {
        delete next[item.itemId];
      } else {
        next[item.itemId] = {
          ...pick(item, SNAPSHOT_FIELDS),
          savedAt: Date.now(),
        };
      }
      return next;
    });
  }

  async function refreshWatchlist() {
    const ids = Object.keys(watchlist).filter((id) => !watchlist[id].ended);
    if (!ids.length) return;

    setRefreshing(true);
    setRefreshError(null);

    try {
      const res = await fetch(`/api/items?${new URLSearchParams({ ids: ids.join(",") })}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.message || `Refresh failed (${res.status})`);
      }

      setWatchlist((current) => {
        const next = { ...current };
        for (const item of data.items) {
          if (!next[item.itemId]) continue;
          // Keep the resale comparables from when it was saved
          next[item.itemId] = {
            ...next[item.itemId],
            ...pick(item, SNAPSHOT_FIELDS.filter((field) => field !== "comps")),
          };
        }
        for (const itemId of data.missing) {
          if (next[itemId]) next[itemId] = { ...next[itemId], ended: true };
        }
        return next;
      });
      setRefreshedAt(Date.now());
      refreshUsage();
    } catch (err) {
      console.error(err);
      setRefreshError(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  function clearEnded() {
    setWatchlist((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([, item]) => !item.ended && isLive(item, Date.now())
        )
      )
    );
  }

  useEffect(() => {
    if (mode !== "watchlist" || refreshing) return;
    if (refreshedAt && Date.now() - refreshedAt < WATCHLIST_STALE_MS) return;
    refreshWatchlist();
    // Only re-run when the watchlist is opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // A value typed on a card with a model reference or name applies to every
  // listing of that model; otherwise it applies to that listing only
  function setResale(item, value) {
    const update = (key) => (current) => {
      const next = { ...current };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    };

    const key = modelKey(item);
    if (key) {
      setModelValues(update(key));
      // Drop any older value for this listing so the model value shows
      setOverrides((current) => {
        const next = { ...current };
        delete next[item.itemId];
        return next;
      });
    } else {
      setOverrides(update(item.itemId));
    }
  }

  function resaleOverride(item) {
    if (overrides[item.itemId] !== undefined) {
      return { value: overrides[item.itemId], source: "listing" };
    }
    const key = modelKey(item);
    const model = key && modelValues[key];
    if (model !== undefined && model !== null && model !== "") {
      return { value: model, source: "model" };
    }
    return undefined;
  }

  const live = useMemo(() => {
    const merged = { ...DEFAULT_SETTINGS, ...settings };

    return results
      .map((item) => ({
        ...analyse(item, merged, resaleOverride(item)),
        sellerCheck: assessSeller(item.seller, merged),
        conditionCheck: conditionGrade(item),
      }))
      .filter((item) => isLive(item, now));
    // resaleOverride reads overrides and modelValues
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, settings, overrides, modelValues, now]);

  const riskyCount = live.filter((item) => item.sellerCheck.level === "risky").length;

  const maxBudget = settings.maxBudget ?? DEFAULT_SETTINGS.maxBudget;
  const overBudget = (item) => maxBudget > 0 && item.totalCost > maxBudget;
  // Counted after risky sellers, so no auction is counted twice
  const overBudgetCount = live.filter(
    (item) => !(hideRisky && item.sellerCheck.level === "risky") && overBudget(item)
  ).length;
  // Counted after risky sellers and the budget, for the same reason
  const otherConditionCount = live.filter(
    (item) =>
      !(hideRisky && item.sellerCheck.level === "risky") &&
      !overBudget(item) &&
      !grades.includes(item.conditionCheck.grade)
  ).length;

  const analysed = useMemo(
    () =>
      live.filter(
        (item) =>
          !(hideRisky && item.sellerCheck.level === "risky") &&
          !overBudget(item) &&
          grades.includes(item.conditionCheck.grade)
      ),
    // overBudget reads maxBudget
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live, hideRisky, maxBudget, grades]
  );

  const visible = useMemo(() => {
    const filtered = analysed.filter((item) => {
      if (view === "deals") return item.status === "deal";
      if (view === "soon") return endsWithin(item, now, 6);
      if (view === "bin") return item.listingType === "BUY_IT_NOW";
      return true;
    });

    return [...filtered].sort(SORTERS[sort]);
  }, [analysed, view, sort, now]);

  const stats = useMemo(() => {
    const priced = analysed.filter((item) => item.profit !== null);
    const deals = analysed.filter((item) => item.status === "deal");
    // Rough estimates can't headline the best profit
    const best = priced.filter((item) => item.status !== "check").reduce(
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

  const watched = useMemo(() => {
    const merged = { ...DEFAULT_SETTINGS, ...settings };

    return Object.values(watchlist)
      .map((item) => ({
        ...analyse(item, merged, resaleOverride(item)),
        sellerCheck: assessSeller(item.seller, merged),
        conditionCheck: conditionGrade(item),
        ended: item.ended || !isLive(item, now),
      }))
      // Live listings first, ending soonest; then ended ones, latest first
      .sort((a, b) =>
        a.ended !== b.ended ? a.ended - b.ended : a.ended ? -SORTERS.ending(a, b) : SORTERS.ending(a, b)
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist, settings, overrides, modelValues, now]);

  const endedCount = watched.filter((item) => item.ended).length;

  const endingSoon = watched.filter(
    (item) => !item.ended && endsWithin(item, now, ENDING_SOON_MINUTES / 60)
  );

  useEffect(() => {
    if (!alertsOn || !("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    const fresh = endingSoon.filter((item) => !alerted[item.itemId]);
    if (!fresh.length) return;

    fresh.forEach((item) => notify(item, now));
    setAlerted((current) => {
      // Forget auctions no longer on the watchlist so the list stays small
      const next = Object.fromEntries(
        Object.entries(current).filter(([itemId]) => watchlist[itemId])
      );
      fresh.forEach((item) => {
        next[item.itemId] = true;
      });
      return next;
    });
    // endingSoon is rebuilt from watched and now on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertsOn, watched, now]);

  const counts = {
    deals: stats.deals,
    soon: analysed.filter((item) => endsWithin(item, now, 6)).length,
    bin: analysed.filter((item) => item.listingType === "BUY_IT_NOW").length,
    all: analysed.length,
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      {/* Soft glow behind the top of the page */}
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.20),transparent)]" />

      {/* The shadow paints the bar's background out to both screen edges
          without the page needing to scroll sideways */}
      <header className="sticky top-0 z-30 mb-6 bg-zinc-950/80 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-[0_0_0_100vmax_rgba(9,9,11,0.8),0_1px_0_100vmax_rgba(255,255,255,0.05)] backdrop-blur-xl [clip-path:inset(0_-100vmax)]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex items-center gap-2.5">
            <img src="/icons/icon-192.png" alt="" className="h-8 w-8 rounded-xl ring-1 ring-white/10" />
            <span className="text-lg font-semibold tracking-tight text-white">Watch Hunter</span>
          </div>

          <nav className="order-last flex w-full rounded-full bg-white/5 p-1 ring-1 ring-white/10 sm:order-none sm:ml-4 sm:w-auto">
            {[
              { key: "scan", label: "Find deals" },
              { key: "watchlist", label: "Watchlist", count: watched.length },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setMode(tab.key)}
                className={`flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition sm:flex-none ${
                  mode === tab.key
                    ? "bg-white text-zinc-950 shadow"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="ml-1.5 tabular-nums opacity-60">{tab.count}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:block">
              <UsageMeter usage={usage} />
            </div>
            <button
              type="button"
              onClick={() => setShowSettings((open) => !open)}
              aria-pressed={showSettings}
              aria-label="Settings"
              title="Settings"
              className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 transition ${
                showSettings
                  ? "bg-white text-zinc-950 ring-white"
                  : "text-zinc-300 ring-white/15 hover:bg-white/5"
              }`}
            >
              <SettingsIcon />
            </button>
          </div>
        </div>
        <div className="mt-3 sm:hidden">
          <UsageMeter usage={usage} />
        </div>
      </header>

      <EndingSoon items={endingSoon} now={now} />

      {showSettings && (
        <div className="mb-6">
          <SettingsPanel
            settings={{ ...DEFAULT_SETTINGS, ...settings }}
            onChange={setSettings}
          />
        </div>
      )}

      {mode === "watchlist" && (
        <Watchlist
          items={watched}
          now={now}
          endedCount={endedCount}
          refreshing={refreshing}
          refreshError={refreshError}
          refreshedAt={refreshedAt}
          onRefresh={refreshWatchlist}
          onClearEnded={clearEnded}
          onToggleSave={toggleSave}
          onSetResale={setResale}
          onFindDeals={() => setMode("scan")}
          alertsOn={alertsOn}
          alertNote={alertNote}
          onEnableAlerts={enableAlerts}
          onDisableAlerts={() => setAlertsOn(false)}
        />
      )}

      {mode === "scan" && (
        <>
          {!scannedBrand && !loading && (
            <div className="mb-6 mt-2 sm:mt-6">
              <h1 className="bg-gradient-to-br from-white via-white to-emerald-300 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-5xl">
                Find watches worth flipping
              </h1>
              <p className="mt-2 max-w-xl text-sm text-zinc-400 sm:text-base">
                UK auctions and Buy It Now listings priced below what they resell for, after fees
                and postage.
              </p>
            </div>
          )}

          <section className="mb-6 rounded-3xl bg-zinc-900/60 p-4 ring-1 ring-white/5 backdrop-blur sm:p-5">
            <form
              className="flex flex-col gap-3 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                scan();
              }}
            >
              <div className="relative flex-1">
                <SearchIcon />
                <input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full rounded-2xl bg-black/30 py-3.5 pl-11 pr-4 text-zinc-50 outline-none ring-1 ring-white/10 transition placeholder:text-zinc-500 focus:ring-2 focus:ring-emerald-400/70"
                  placeholder="Brand or model, such as Seiko SKX007"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-300 px-6 py-3.5 font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:opacity-60"
              >
                {loading && !topProgress ? "Scanning…" : "Find deals"}
              </button>
              <button
                type="button"
                onClick={scanTopDeals}
                disabled={loading}
                title={`Scan ${POPULAR.join(", ")} and show the best deals across all of them`}
                className="rounded-2xl px-5 py-3.5 font-semibold text-emerald-300 ring-1 ring-emerald-400/40 transition hover:bg-emerald-400/10 disabled:opacity-60"
              >
                {topProgress
                  ? `Scanning ${topProgress.done}/${topProgress.total}…`
                  : "Top deals"}
              </button>
            </form>

            <div className="mt-4">
              <BrandPicker
                selected={scannedBrand}
                disabled={loading}
                onPick={scan}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/5 pt-4">
              <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Watches located in the UK
              </span>
              <label className="flex items-center gap-2 text-xs text-zinc-400">
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

            <div className="mt-3">
              <ListingTypeFilter selected={listingTypes} onChange={setListingTypes} />
            </div>

            <ConditionFilter
              selected={grades}
              onChange={setGrades}
              goodOrBetter={GOOD_OR_BETTER}
            />
          </section>

          {error && (
            <div className="mb-6 rounded-2xl bg-rose-950/40 p-4 text-sm text-rose-200 ring-1 ring-rose-500/40">
              {error}
            </div>
          )}

          {loading && topProgress && (
            <p className="mb-4 text-sm text-zinc-400">
              Checking {POPULAR.length} popular brands for the best deals.
              This takes a little longer than a single brand.
            </p>
          )}

          {loading && <LoadingGrid />}

          {!loading && topFailures.length > 0 && (
            <div className="mb-6 rounded-2xl bg-amber-950/30 p-4 text-sm text-amber-200 ring-1 ring-amber-500/30">
              Couldn't scan {topFailures.join(", ")}. The deals below are from the other brands.
            </div>
          )}

          {!loading && scannedBrand && !error && results.length === 0 && scanStats && (
            <ScanExplainer
              brand={scannedBrand}
              stats={scanStats}
              includeJunk={includeJunk}
              includesBuyItNow={listingTypes.includes("BUY_IT_NOW")}
            />
          )}

          {!loading && scannedBrand && !error && !(results.length === 0 && scanStats) && (
            <>
              <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat
                  label="Listings found"
                  value={stats.scanned}
                  note={hiddenNote([
                    hideRisky && riskyCount > 0 && `${riskyCount} from risky sellers`,
                    overBudgetCount > 0 &&
                      `${overBudgetCount} over your ${formatGbp(maxBudget)} limit`,
                    otherConditionCount > 0 &&
                      `${otherConditionCount} in other conditions`,
                  ])}
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
                  label="Best profit"
                  value={formatGbp(stats.best)}
                  accent={stats.best !== null && stats.best > 0}
                />
              </section>

              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1">
                  {VIEWS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setView(option.key)}
                      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition ${
                        view === option.key
                          ? "bg-white text-zinc-950 ring-white"
                          : "text-zinc-400 ring-white/10 hover:text-zinc-100"
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
                  className="rounded-full bg-zinc-900/80 px-3.5 py-1.5 text-sm text-zinc-200 outline-none ring-1 ring-white/10"
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
                      saved={Boolean(watchlist[item.itemId])}
                      onToggleSave={toggleSave}
                    />
                  ))}
                </div>
              ) : (
                <EmptyView view={view} onShowAll={() => setView("all")} />
              )}
            </>
          )}

          {!loading && !scannedBrand && !error && <Intro />}
        </>
      )}
    </main>
  );
}

const SORTERS = {
  profit: (a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity),
  roi: (a, b) => (b.roi ?? -Infinity) - (a.roi ?? -Infinity),
  headroom: (a, b) =>
    (b.maxBid === null ? -Infinity : b.maxBid - b.currentBid) -
    (a.maxBid === null ? -Infinity : a.maxBid - a.currentBid),
  // Buy It Now listings have no end time, so they go after every auction
  ending: (a, b) => endMs(a) - endMs(b),
};

function endMs(item) {
  return item.endTime ? new Date(item.endTime).getTime() : Infinity;
}

// Buy It Now listings stay live until eBay stops returning them
function isLive(item, now) {
  return item.listingType === "BUY_IT_NOW" || hoursLeft(item.endTime, now) > 0;
}

function endsWithin(item, now, hours) {
  return item.listingType !== "BUY_IT_NOW" && hoursLeft(item.endTime, now) < hours;
}

function Watchlist({
  items,
  now,
  endedCount,
  refreshing,
  refreshError,
  refreshedAt,
  onRefresh,
  onClearEnded,
  onToggleSave,
  onSetResale,
  onFindDeals,
  alertsOn,
  alertNote,
  onEnableAlerts,
  onDisableAlerts,
}) {
  if (!items.length) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-zinc-900/30 px-6 py-12 text-center">
        <p className="text-sm text-zinc-300">Your watchlist is empty.</p>
        <p className="mt-1 text-xs text-zinc-500">
          Tap the bookmark on any auction to save it here.
        </p>
        <button
          type="button"
          onClick={onFindDeals}
          className="mt-4 rounded-xl px-4 py-2 text-sm text-zinc-200 ring-1 ring-zinc-700 hover:ring-zinc-500"
        >
          Find deals
        </button>
      </div>
    );
  }

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">
          {refreshing
            ? "Checking eBay for the latest bids…"
            : refreshedAt
            ? `Bids updated ${new Date(refreshedAt).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : "Showing bids from when you saved each auction"}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={alertsOn ? onDisableAlerts : onEnableAlerts}
            aria-pressed={alertsOn}
            className={`rounded-full px-3.5 py-2 text-sm font-medium ring-1 transition ${
              alertsOn
                ? "bg-emerald-400/15 text-emerald-300 ring-emerald-400/40"
                : "text-zinc-300 ring-white/10 hover:bg-white/5"
            }`}
          >
            {alertsOn ? "Alerts on" : "Alert me 10 min before"}
          </button>
          {endedCount > 0 && (
            <button
              type="button"
              onClick={onClearEnded}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-zinc-300 ring-1 ring-white/10 hover:bg-white/5"
            >
              Clear {endedCount} ended
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : "Refresh bids"}
          </button>
        </div>
      </div>

      {alertNote && (
        <div className="mb-5 rounded-2xl bg-amber-950/30 p-4 text-sm text-amber-200 ring-1 ring-amber-500/30">
          {alertNote}
        </div>
      )}

      {refreshError && (
        <div className="mb-5 rounded-2xl bg-rose-950/40 p-4 text-sm text-rose-200 ring-1 ring-rose-500/40">
          Couldn't refresh from eBay: {refreshError}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <AuctionCard
            key={item.itemId}
            item={item}
            now={now}
            onSetResale={onSetResale}
            saved
            onToggleSave={onToggleSave}
          />
        ))}
      </div>
    </section>
  );
}

// "Hidden: 3 from risky sellers, 2 over your £200 limit", or null
function hiddenNote(parts) {
  const text = parts.filter(Boolean).join(", ");
  return text ? `Hidden: ${text}` : null;
}

// Shows a notification through the service worker where there is one, as
// Android requires, or straight from the page otherwise
async function notify(item, now) {
  const title = `Ends in ${formatTimeLeft(item.endTime, now)}: ${item.title}`;
  const options = {
    body:
      item.maxBid !== null
        ? `Now ${formatGbp(item.totalCost)}. Bid up to ${formatGbp(item.maxBid)}.`
        : `Now ${formatGbp(item.totalCost)}.`,
    tag: item.itemId,
    icon: "/icons/icon-192.png",
    data: { url: item.url },
  };

  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
  } catch (err) {
    // The banner still shows the auction
    console.error(err);
  }
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" strokeLinecap="round" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  );
}

function pick(object, fields) {
  return Object.fromEntries(
    fields.filter((field) => field in object).map((field) => [field, object[field]])
  );
}

function Stat({ label, value, note, accent = false }) {
  return (
    <div
      className={`rounded-2xl px-4 py-3.5 ring-1 backdrop-blur ${
        accent
          ? "bg-gradient-to-br from-emerald-400/15 to-teal-300/5 ring-emerald-400/25"
          : "bg-zinc-900/60 ring-white/5"
      }`}
    >
      <div className="text-[11px] font-medium uppercase tracking-widest text-zinc-400">{label}</div>
      <div
        className={`mt-1 text-3xl font-bold tracking-tight tabular-nums ${
          accent ? "text-emerald-300" : "text-zinc-50"
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
    <div className="rounded-3xl border border-dashed border-white/10 bg-zinc-900/30 px-6 py-12 text-center">
      <p className="text-sm text-zinc-300">
        {view === "deals"
          ? "Nothing clears your target profit right now."
          : "No listings match this view."}
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
      body: "Pulls live UK auctions and Buy It Now listings, with parts, replicas and risky sellers filtered out.",
    },
    {
      title: "Estimate resale",
      body: "Compares current asking prices for the same model, matched by reference or by well-known names like Turtle or Black Bay.",
    },
    {
      title: "Bid to your limit",
      body: "Each card shows profit after fees and postage, and the most you can bid or offer to still hit your target.",
    },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-3">
      {steps.map((step, index) => (
        <div
          key={step.title}
          className="rounded-3xl bg-zinc-900/60 p-5 ring-1 ring-white/5 backdrop-blur"
        >
          <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-300 text-sm font-bold text-emerald-950">
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
          className="animate-pulse overflow-hidden rounded-3xl bg-zinc-900/60 ring-1 ring-white/5"
        >
          <div className="aspect-[16/11] bg-zinc-800/80" />
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
