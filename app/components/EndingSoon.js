"use client";

import { formatGbp, formatTimeLeft } from "./format";

// Saved auctions about to end, pinned above everything else
export default function EndingSoon({ items, now }) {
  if (!items.length) return null;

  return (
    <section className="mb-6 rounded-2xl bg-rose-950/40 p-4 ring-1 ring-rose-500/40">
      <h2 className="mb-3 text-sm font-medium text-rose-200">
        Ending soon on your watchlist
      </h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.itemId} className="flex items-center gap-3 text-sm">
            <span className="w-14 shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-center text-xs font-medium tabular-nums text-white">
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
              Bid
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
