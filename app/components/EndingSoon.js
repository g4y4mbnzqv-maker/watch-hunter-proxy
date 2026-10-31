"use client";

import { formatGbp, formatTimeLeft } from "./format";
import { FINAL_CALL_MINUTES } from "../client/useWatchlist";

// Saved auctions about to end, pinned above everything else
export default function EndingSoon({ items, now }) {
  if (!items.length) return null;

  return (
    <section className="mb-6 rounded-3xl bg-gradient-to-br from-rose-500/15 to-rose-500/5 p-4 ring-1 ring-rose-400/30 backdrop-blur">
      <h2 className="mb-3 text-sm font-medium text-rose-200">
        Ending soon on your watchlist
      </h2>
      <ul className="space-y-2">
        {items.map((item) => {
          const lastCall = new Date(item.endTime).getTime() - now <= FINAL_CALL_MINUTES * 60_000;
          return (
            <li key={item.itemId} className={`flex items-center gap-3 text-sm ${lastCall ? "rounded-xl bg-rose-500/20 p-1.5 ring-1 ring-rose-400/60" : ""}`}>
              <span className={`w-14 shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-center text-xs font-medium tabular-nums text-white ${lastCall ? "motion-safe:animate-pulse" : ""}`}>
                {formatTimeLeft(item.endTime, now)}
              </span>
              <span className="min-w-0 flex-1 truncate text-zinc-100">{item.title}</span>
              <span className="hidden shrink-0 text-xs text-zinc-400 sm:inline">
                {item.maxBid !== null
                  ? `Bid up to ${formatGbp(item.maxBid)}`
                  : `Now ${formatGbp(item.totalCost)}`}
              </span>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg bg-white px-3 py-1 text-xs font-medium text-zinc-950 hover:bg-zinc-200"
              >
                {lastCall ? "Bid now" : "Bid"}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
