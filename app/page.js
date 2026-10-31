"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppHeader from "./components/AppHeader";
import SearchPanel from "./components/SearchPanel";
import Results from "./components/Results";
import Watchlist from "./components/Watchlist";
import PriceIndex from "./components/PriceIndex";
import DealLog from "./components/DealLog";
import SettingsPanel from "./components/SettingsPanel";
import EndingSoon from "./components/EndingSoon";
import LimitBanner from "./components/LimitBanner";
import ScanExplainer from "./components/ScanExplainer";
import { LISTING_TYPES } from "./components/ListingTypeFilter";
import { Hero, Intro, LoadingGrid, Notice } from "./components/Placeholders";
import { useNow, useStoredState } from "./client/hooks";
import { analyseAll, isLive } from "./client/listings";
import { useScanner } from "./client/useScanner";
import { useUsage } from "./client/useUsage";
import { useWatchlist } from "./client/useWatchlist";
import { useDeals } from "./client/useDeals";
import { useTrends } from "./client/useTrends";
import { trendFor } from "@/lib/indexKey";
import { cleanTopBrands } from "./client/topBrands";
import { POPULAR } from "@/lib/brands";
import { DEFAULT_SETTINGS } from "@/lib/profit";
import { modelKey } from "@/lib/models";
import { GRADES } from "@/lib/condition";

const ALL_GRADES = GRADES.map((option) => option.key);
const ALL_LISTING_TYPES = LISTING_TYPES.map((option) => option.key);

// Opening the watchlist refreshes it if the last refresh is older than this
const WATCHLIST_STALE_MS = 60_000;

export default function Home() {
  const now = useNow(30_000);
  const [mode, setMode] = useState("scan");
  const [showSettings, setShowSettings] = useState(false);
  const [view, setView] = useState("deals");
  const [sort, setSort] = useState("ending");
  // Cards or the swipe deck, remembered in this browser
  const [layout, setLayout] = useStoredState("wh-layout", "cards");
  // Counts scans, so the card grid starts from its first page on each one
  const [scanId, setScanId] = useState(0);

  const [storedSettings, setSettings] = useStoredState("wh-settings", DEFAULT_SETTINGS, { sync: true });
  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...storedSettings }), [storedSettings]);
  // Resale values typed for one listing, by item ID
  const [overrides, setOverrides] = useStoredState("wh-resale-overrides", {}, { sync: true });
  // Resale values typed for a model, by base reference or model name
  const [modelValues, setModelValues] = useStoredState("wh-model-values", {}, { sync: true });
  const [includeJunk, setIncludeJunk] = useState(false);
  const [hideRisky, setHideRisky] = useStoredState("wh-hide-risky", true, { sync: true });
  // Only listings eBay authenticates itself
  const [guaranteedOnly, setGuaranteedOnly] = useStoredState("wh-guaranteed-only", false, { sync: true });
  // Condition grades to show; every grade by default
  const [grades, setGrades] = useStoredState("wh-grades", ALL_GRADES, { sync: true });
  // Auctions, Buy It Now or both; both by default
  const [listingTypes, setListingTypes] = useStoredState("wh-types", ALL_LISTING_TYPES, { sync: true });
  // Brands Top deals scans, popular ones to start with
  const [storedTopBrands, setTopBrands] = useStoredState("wh-top-brands", POPULAR, { sync: true });
  const topBrands = useMemo(() => cleanTopBrands(storedTopBrands), [storedTopBrands]);

  const usage = useUsage(now);
  const { trends, models: indexModels, refreshTrends } = useTrends();
  const dealBook = useDeals();
  // The deal to open when the sales log is shown, after "I bought this"
  const [openDealId, setOpenDealId] = useState(null);
  const { logPurchase } = dealBook;
  const onLogPurchase = useCallback(
    (item) => {
      setOpenDealId(logPurchase(item));
      setMode("deals");
      window.scrollTo({ top: 0 });
    },
    [logPurchase]
  );

  useEffect(() => {
    // Phones need a service worker to show notifications
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const resaleOverride = useCallback(
    (item) => {
      if (overrides[item.itemId] !== undefined) {
        return { value: overrides[item.itemId], source: "listing" };
      }
      const key = modelKey(item);
      const model = key && modelValues[key];
      if (model !== undefined && model !== null && model !== "") {
        return { value: model, source: "model" };
      }
      return undefined;
    },
    [overrides, modelValues]
  );

  // A value typed on a card with a model reference or name applies to every
  // listing of that model; otherwise it applies to that listing only
  const setResale = useCallback(
    (item, value) => {
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
    },
    [setModelValues, setOverrides]
  );

  const scanner = useScanner({
    listingTypes,
    includeJunk,
    onLimitHit: usage.markLimitHit,
    onScanned: ({ topDeals }) => {
      setScanId((id) => id + 1);
      if (topDeals) {
        setView("deals");
        setSort("profit");
      }
      usage.refreshUsage();
      // The scan just added today's prices to the index
      refreshTrends();
    },
  });

  const watch = useWatchlist({
    settings,
    resaleOverride,
    now,
    onLimitHit: usage.markLimitHit,
    onRefreshed: usage.refreshUsage,
  });

  useEffect(() => {
    if (mode !== "watchlist" || watch.refreshing || usage.limitPaused) return;
    if (watch.refreshedAt && Date.now() - watch.refreshedAt < WATCHLIST_STALE_MS) return;
    watch.refresh();
    // Only re-run when the watchlist is opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Profit and checks don't depend on the time, so the 30-second tick only
  // re-filters for listings that have ended
  const analysed = useMemo(
    () => withTrends(analyseAll(scanner.results, settings, resaleOverride), trends),
    [scanner.results, settings, resaleOverride, trends]
  );
  const live = useMemo(() => analysed.filter((item) => isLive(item, now)), [analysed, now]);

  const { shown, hidden } = useMemo(() => {
    const isRisky = (item) => hideRisky && item.sellerCheck.level === "risky";
    const overBudget = (item) => settings.maxBudget > 0 && item.totalCost > settings.maxBudget;
    const counts = { risky: 0, overBudget: 0, otherCondition: 0, notGuaranteed: 0 };
    const kept = [];

    // Each hidden listing is counted once, under the first reason that applies
    for (const item of live) {
      if (isRisky(item)) counts.risky++;
      else if (overBudget(item)) counts.overBudget++;
      else if (!grades.includes(item.conditionCheck.grade)) counts.otherCondition++;
      else if (guaranteedOnly && !item.authenticityGuarantee) counts.notGuaranteed++;
      else kept.push(item);
    }
    return { shown: kept, hidden: counts };
  }, [live, hideRisky, settings.maxBudget, grades, guaranteedOnly]);

  const { watchlist } = watch;
  const watchItems = useMemo(() => withTrends(watch.items, trends), [watch.items, trends]);
  const isSaved = useCallback((itemId) => Boolean(watchlist[itemId]), [watchlist]);

  const hasResults = !(scanner.results.length === 0 && scanner.scanStats);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      {/* Soft glow behind the top of the page */}
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.20),transparent)]" />

      <AppHeader
        mode={mode}
        onModeChange={setMode}
        watchCount={watch.items.length}
        usage={usage.usage}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings((open) => !open)}
      />

      {usage.limitPaused && <LimitBanner resetAt={usage.resetAt} onRetry={usage.clearLimit} />}

      <EndingSoon items={watch.endingSoon} now={now} />

      {showSettings && (
        <div className="mb-6">
          <SettingsPanel settings={settings} onChange={setSettings} />
        </div>
      )}

      {mode === "watchlist" && (
        <Watchlist
          watch={watch}
          items={watchItems}
          now={now}
          paused={usage.limitPaused}
          onSetResale={setResale}
          onFindDeals={() => setMode("scan")}
          onLogPurchase={onLogPurchase}
        />
      )}

      {mode === "deals" && (
        <DealLog
          dealBook={dealBook}
          settings={settings}
          onSettingsChange={setSettings}
          openId={openDealId}
          models={indexModels}
          onFindDeals={() => setMode("scan")}
        />
      )}

      {mode === "index" && <PriceIndex />}

      {mode === "scan" && (
        <>
          {!scanner.scannedBrand && !scanner.loading && <Hero />}

          <SearchPanel
            scannedBrand={scanner.scannedBrand}
            loading={scanner.loading}
            paused={usage.limitPaused}
            topProgress={scanner.topProgress}
            onScan={scanner.scan}
            onTopDeals={() => scanner.scanTopDeals(topBrands)}
            topBrands={topBrands}
            onTopBrandsChange={setTopBrands}
            includeJunk={includeJunk}
            onIncludeJunkChange={setIncludeJunk}
            hideRisky={hideRisky}
            onHideRiskyChange={setHideRisky}
            guaranteedOnly={guaranteedOnly}
            onGuaranteedOnlyChange={setGuaranteedOnly}
            listingTypes={listingTypes}
            onListingTypesChange={setListingTypes}
            grades={grades}
            onGradesChange={setGrades}
          />

          {scanner.error && <Notice tone="rose">{scanner.error}</Notice>}

          {scanner.loading && scanner.topProgress && (
            <p className="mb-4 text-sm text-zinc-400">
              Checking {topBrands.length} {topBrands.length === 1 ? "brand" : "brands"} for the best deals. This takes a little
              longer than a single brand.
            </p>
          )}

          {scanner.loading && <LoadingGrid />}

          {!scanner.loading && scanner.topFailures.length > 0 && (
            <Notice>
              Couldn't scan {scanner.topFailures.join(", ")}. The deals below are from the other
              brands.
            </Notice>
          )}

          {!scanner.loading && scanner.scannedBrand && !scanner.error && !hasResults && (
            <ScanExplainer
              brand={scanner.scannedBrand}
              stats={scanner.scanStats}
              includeJunk={includeJunk}
              includesBuyItNow={listingTypes.includes("BUY_IT_NOW")}
            />
          )}

          {!scanner.loading && scanner.scannedBrand && !scanner.error && hasResults && (
            <Results
              scanId={scanId}
              shown={shown}
              hidden={hidden}
              minProfit={settings.minProfit}
              maxBudget={settings.maxBudget}
              view={view}
              onViewChange={setView}
              sort={sort}
              onSortChange={setSort}
              layout={layout}
              onLayoutChange={setLayout}
              now={now}
              isSaved={isSaved}
              onToggleSave={watch.toggleSave}
              onSetResale={setResale}
            />
          )}

          {!scanner.loading && !scanner.scannedBrand && !scanner.error && <Intro />}
        </>
      )}
    </main>
  );
}

// Adds each listing's 30-day model price change from the price index
function withTrends(items, trends) {
  if (!Object.keys(trends).length) return items;
  return items.map((item) => {
    const trend = trendFor(item, trends);
    return trend ? { ...item, trend } : item;
  });
}
