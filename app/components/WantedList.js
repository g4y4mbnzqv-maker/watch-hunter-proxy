"use client";

import { useState } from "react";
import { formatGbp, formatTimeLeft } from "./format";
import { AUCTION_WINDOW_HOURS, MAX_WANTED, cleanWanted } from "@/lib/wanted";

// Models you're after and the most you'd pay. The hourly alert check looks
// for them; "Search now" looks straight away.
export default function WantedList({ wanted, onChange, now, paused }) {
  const list = cleanWanted(wanted);
  const [query, setQuery] = useState("");
  const [price, setPrice] = useState("");
  const [open, setOpen] = useState(list.length > 0);

  function add(e) {
    e.preventDefault();
    const maxPrice = Number(price);
    if (!query.trim() || !(maxPrice > 0)) return;
    onChange(cleanWanted([...list, { id: `${Date.now()}`, query: query.trim(), maxPrice }]));
    setQuery("");
    setPrice("");
  }

  return (
    <section className="mb-6 rounded-2xl bg-zinc-900/60 p-4 ring-1 ring-white/5">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center justify-between text-left">
        <span className="text-sm font-medium text-zinc-100">
          Wanted list <span className="ml-1 text-xs font-normal text-zinc-500">{list.length ? `${list.length} models` : "nothing yet"}</span>
        </span>
        <span className="text-xs text-zinc-400">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="mt-3">
          <p className="mb-3 text-xs leading-relaxed text-zinc-400">
            Add models you're after and the most you'd pay, postage included. With deal alerts on, you get a notification
            when one is listed at or under your price: Buy It Now straight away, auctions in their last{" "}
            {AUCTION_WINDOW_HOURS} hours if the bid is still under.
          </p>

          <form onSubmit={add} className="mb-3 flex flex-wrap gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Model, such as Seiko SKX007"
              aria-label="Model you want"
              className="min-w-0 flex-[2] rounded-xl bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none ring-1 ring-white/10 placeholder:text-zinc-500 focus:ring-emerald-400/50"
            />
            <div className="relative min-w-[6rem] flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">£</span>
              <input
                type="number"
                inputMode="decimal"
                min="1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Max"
                aria-label="Most you'd pay"
                className="w-full rounded-xl bg-black/30 py-2 pl-7 pr-3 text-sm text-zinc-100 outline-none ring-1 ring-white/10 placeholder:text-zinc-500 focus:ring-emerald-400/50"
              />
            </div>
            <button
              type="submit"
              disabled={list.length >= MAX_WANTED || !query.trim() || !(Number(price) > 0)}
              className="rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-40"
            >
              Add
            </button>
          </form>

          <ul className="space-y-2">
            {list.map((want) => (
              <WantedRow
                key={want.id}
                want={want}
                now={now}
                paused={paused}
                onRemove={() => onChange(list.filter((entry) => entry.id !== want.id))}
              />
            ))}
          </ul>
          {list.length >= MAX_WANTED && (
            <p className="mt-2 text-[11px] text-zinc-500">The limit is {MAX_WANTED} models, to keep the hourly check within eBay's allowance.</p>
          )}
        </div>
      )}
    </section>
  );
}

function WantedRow({ want, now, paused, onRemove }) {
  const [state, setState] = useState(null);

  async function searchNow() {
    setState({ loading: true });
    try {
      const params = new URLSearchParams({ brand: want.query, types: "AUCTION,BUY_IT_NOW" });
      const res = await fetch(`/api/scan?${params}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.message || `Search failed (${res.status})`);
      const under = data.results
        .filter((item) => item.totalCost > 0 && item.totalCost <= want.maxPrice)
        .sort((a, b) => a.totalCost - b.totalCost)
        .slice(0, 8);
      setState({ results: under, total: data.results.length });
    } catch (err) {
      setState({ error: err.message });
    }
  }

  return (
    <li className="rounded-xl bg-black/20 p-3 ring-1 ring-white/5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 text-sm text-zinc-100">
          {want.query} <span className="text-zinc-400">under {formatGbp(want.maxPrice)}</span>
        </span>
        <button
          type="button"
          onClick={searchNow}
          disabled={paused || state?.loading}
          className="rounded-full px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-400/40 hover:bg-emerald-400/10 disabled:opacity-50"
        >
          {state?.loading ? "Searching…" : "Search now"}
        </button>
        <button type="button" onClick={onRemove} aria-label={`Remove ${want.query}`} className="px-1 text-xs text-zinc-500 hover:text-rose-300">
          ✕
        </button>
      </div>

      {state?.error && <p className="mt-2 text-xs text-rose-300">{state.error}</p>}
      {state?.results && (
        <div className="mt-2 text-xs">
          {state.results.length === 0 ? (
            <p className="text-zinc-500">
              None at or under {formatGbp(want.maxPrice)} right now, out of {state.total} UK listings.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {state.results.map((item) => (
                <li key={item.itemId} className="flex items-baseline justify-between gap-3">
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-zinc-200 hover:text-white">
                    {item.title}
                  </a>
                  <span className="shrink-0 tabular-nums text-zinc-400">
                    <span className="font-semibold text-emerald-300">{formatGbp(item.totalCost)}</span>
                    {item.listingType === "BUY_IT_NOW" ? " · Buy It Now" : ` · ${formatTimeLeft(item.endTime, now)} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {state.results.some((item) => item.listingType !== "BUY_IT_NOW") && (
            <p className="mt-1.5 text-[11px] text-zinc-500">Auction prices are the current bid; they usually rise near the end.</p>
          )}
        </div>
      )}
    </li>
  );
}
