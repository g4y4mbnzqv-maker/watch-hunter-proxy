"use client";

import CardGrid from "./CardGrid";
import { EmptyState, Notice } from "./Placeholders";

export default function Watchlist({ watch, now, paused, onSetResale, onFindDeals }) {
  if (!watch.items.length) {
    return (
      <EmptyState
        title="Your watchlist is empty."
        body="Tap the bookmark on any listing to save it here."
        action="Find deals"
        onAction={onFindDeals}
      />
    );
  }

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">
          {watch.refreshing
            ? "Checking eBay for the latest bids…"
            : watch.refreshedAt
            ? `Bids updated ${new Date(watch.refreshedAt).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : "Showing bids from when you saved each listing"}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={watch.alertsOn ? watch.disableAlerts : watch.enableAlerts}
            aria-pressed={watch.alertsOn}
            className={`rounded-full px-3.5 py-2 text-sm font-medium ring-1 transition ${
              watch.alertsOn
                ? "bg-emerald-400/15 text-emerald-300 ring-emerald-400/40"
                : "text-zinc-300 ring-white/10 hover:bg-white/5"
            }`}
          >
            {watch.alertsOn ? "Alerts on" : "Alert me 10 min before"}
          </button>
          {watch.endedCount > 0 && (
            <button
              type="button"
              onClick={watch.clearEnded}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-zinc-300 ring-1 ring-white/10 hover:bg-white/5"
            >
              Clear {watch.endedCount} ended
            </button>
          )}
          <button
            type="button"
            onClick={watch.refresh}
            disabled={watch.refreshing || paused}
            className="rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-60"
          >
            {watch.refreshing ? "Refreshing…" : "Refresh bids"}
          </button>
        </div>
      </div>

      {watch.alertNote && <Notice>{watch.alertNote}</Notice>}
      {watch.refreshError && (
        <Notice tone="rose">Couldn't refresh from eBay: {watch.refreshError}</Notice>
      )}

      <CardGrid
        items={watch.items}
        now={now}
        isSaved={() => true}
        onToggleSave={watch.toggleSave}
        onSetResale={onSetResale}
      />
    </section>
  );
}
