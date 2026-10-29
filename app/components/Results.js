"use client";

import { useMemo } from "react";
import CardGrid from "./CardGrid";
import SwipeDeck from "./SwipeDeck";
import { EmptyState, Stat } from "./Placeholders";
import { formatGbp } from "./format";
import { SORTERS, endsWithin, hiddenNote } from "../client/listings";

const VIEWS = [
  { key: "deals", label: "Deals" },
  { key: "soon", label: "Ending in 6h" },
  { key: "bin", label: "Buy It Now" },
  { key: "all", label: "Everything" },
];

const SORTS = [
  { key: "ending", label: "Ending soonest" },
  { key: "profit", label: "Highest profit" },
  { key: "headroom", label: "Most headroom" },
  { key: "roi", label: "Best return" },
];

const LAYOUTS = [
  { key: "cards", label: "Cards" },
  { key: "swipe", label: "Swipe" },
];

const IN_VIEW = {
  deals: (item) => item.status === "deal",
  soon: (item, now) => endsWithin(item, now, 6),
  bin: (item) => item.listingType === "BUY_IT_NOW",
  all: () => true,
};

// Stats, view tabs, sort and the cards for one scan
export default function Results({
  scanId,
  shown,
  hidden,
  minProfit,
  maxBudget,
  view,
  onViewChange,
  sort,
  onSortChange,
  layout,
  onLayoutChange,
  now,
  isSaved,
  onToggleSave,
  onSetResale,
}) {
  const stats = useMemo(() => {
    const priced = shown.filter((item) => item.profit !== null);
    // Rough estimates can't headline the best profit
    const best = priced
      .filter((item) => item.status !== "check")
      .reduce((top, item) => (top === null || item.profit > top.profit ? item : top), null);
    return { priced: priced.length, best: best?.profit ?? null };
  }, [shown]);

  const counts = useMemo(
    () => Object.fromEntries(VIEWS.map(({ key }) => [key, shown.filter((item) => IN_VIEW[key](item, now)).length])),
    [shown, now]
  );

  const visible = useMemo(
    () => shown.filter((item) => IN_VIEW[view](item, now)).sort(SORTERS[sort]),
    [shown, view, sort, now]
  );

  return (
    <>
      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Listings found"
          value={shown.length}
          note={hiddenNote([
            hidden.risky > 0 && `${hidden.risky} from risky sellers`,
            hidden.overBudget > 0 && `${hidden.overBudget} over your ${formatGbp(maxBudget)} limit`,
            hidden.otherCondition > 0 && `${hidden.otherCondition} in other conditions`,
          ])}
        />
        <Stat label="With a resale estimate" value={stats.priced} />
        <Stat label={`Clearing ${formatGbp(minProfit)}`} value={counts.deals} accent={counts.deals > 0} />
        <Stat label="Best profit" value={formatGbp(stats.best)} accent={stats.best !== null && stats.best > 0} />
      </section>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1">
          {VIEWS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onViewChange(option.key)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition ${
                view === option.key ? "bg-white text-zinc-950 ring-white" : "text-zinc-400 ring-white/10 hover:text-zinc-100"
              }`}
            >
              {option.label}
              <span className="ml-1.5 tabular-nums opacity-60">{counts[option.key]}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-full p-0.5 ring-1 ring-white/10" role="group" aria-label="Layout">
            {LAYOUTS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => onLayoutChange(option.key)}
                aria-pressed={layout === option.key}
                className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                  layout === option.key ? "bg-white/10 text-zinc-50" : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
            className="rounded-full bg-zinc-900/80 px-3.5 py-1.5 text-sm text-zinc-200 outline-none ring-1 ring-white/10"
          >
            {SORTS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {layout === "swipe" && visible.length > 0 ? (
        <SwipeDeck
          // A new scan, view or sort deals again from the top
          key={`${scanId}|${view}|${sort}`}
          items={visible}
          now={now}
          isSaved={isSaved}
          onToggleSave={onToggleSave}
          onSetResale={onSetResale}
          onShowCards={() => onLayoutChange("cards")}
        />
      ) : visible.length > 0 ? (
        <CardGrid
          // A new scan, view or sort starts again from the first page
          key={`${scanId}|${view}|${sort}`}
          items={visible}
          now={now}
          isSaved={isSaved}
          onToggleSave={onToggleSave}
          onSetResale={onSetResale}
        />
      ) : view === "deals" ? (
        <EmptyState
          title="Nothing clears your target profit right now."
          body="Try another brand, lower the target in Settings, or add your own resale values."
          action="Show everything"
          onAction={() => onViewChange("all")}
        />
      ) : (
        <EmptyState
          title="No listings match this view."
          body="Try another brand or view."
          action={view !== "all" ? "Show everything" : null}
          onAction={() => onViewChange("all")}
        />
      )}
    </>
  );
}
