"use client";

import { useState } from "react";
import { formatGbp } from "./format";
import { fetchPrices } from "../client/priceCheck";
import { analyse } from "@/lib/profit";
import { brandFromTitle } from "@/lib/brands";
import { oftenFakedBrand } from "@/lib/fakes";
import { extractModelRef } from "@/lib/models";
import { extractModelName } from "@/lib/nicknames";

const VERDICTS = {
  deal: { label: "Deal", tone: "bg-emerald-400 text-emerald-950" },
  thin: { label: "Thin margin", tone: "bg-amber-300 text-amber-950" },
  check: { label: "Check value", tone: "bg-amber-300 text-amber-950" },
  loss: { label: "Loss", tone: "bg-rose-400 text-rose-950" },
};

const INPUT =
  "w-full rounded-xl bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none ring-1 ring-white/10 focus:ring-emerald-400/50";

// Values a watch seen on Vinted, Facebook, Gumtree or anywhere else against
// today's eBay asking prices, with the same profit sums and fake checks as a
// scan. Nothing is fetched from the other site: you copy the title and price.
export default function ListingCheck({ settings }) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function check(e) {
    e.preventDefault();
    const cost = Number(price);
    if (!title.trim() || !(cost > 0) || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const [comps] = await fetchPrices([title.trim()]);
      const modelRef = extractModelRef(title);
      const item = {
        title: title.trim(),
        brand: brandFromTitle(title) ?? "",
        modelRef,
        modelName: modelRef ? null : extractModelName(title),
        currentBid: cost,
        postage: 0,
        totalCost: cost,
        // A fixed price, so the too-cheap check applies as for Buy It Now
        listingType: "BUY_IT_NOW",
        comps,
      };
      setResult({ ...analyse(item, settings), oftenFaked: oftenFakedBrand(item) });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const verdict = result && VERDICTS[result.status];
  const overBudget = result && settings.maxBudget > 0 && result.totalCost > settings.maxBudget;

  return (
    <details className="mb-6 rounded-2xl bg-zinc-900/60 ring-1 ring-white/5 [&_summary::-webkit-details-marker]:hidden">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-zinc-200">
        Check a watch from another site
        <span className="ml-2 text-xs font-normal text-zinc-500">Vinted, Facebook, Gumtree…</span>
      </summary>
      <form onSubmit={check} className="space-y-3 px-4 pb-4">
        <p className="text-xs text-zinc-500">
          Copy the listing's title and the total you'd pay. The app values it against today's eBay prices.
        </p>
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-400">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Seiko SKX007 automatic diver"
            className={INPUT}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-400">Total you'd pay, including postage and buyer fees</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">£</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={`${INPUT} pl-7`}
            />
          </div>
        </label>
        <button
          type="submit"
          disabled={busy || !title.trim() || !(Number(price) > 0)}
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-40"
        >
          {busy ? "Checking…" : "Check it"}
        </button>

        {error && <p className="text-xs text-rose-300">{error}</p>}

        {result && (
          <div role="status" className="rounded-xl bg-black/30 p-3 text-sm ring-1 ring-white/10">
            {result.status === "unknown" ? (
              <p className="text-zinc-300">
                {result.modelRef || result.modelName
                  ? "Too few similar watches on eBay right now to estimate a price."
                  : "No model reference or known model name in that title, so there's nothing to compare it with. Add the reference (often on the caseback) and check again."}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${verdict.tone}`}>{verdict.label}</span>
                  <span className="text-zinc-100">
                    Profit about <strong className="tabular-nums">{formatGbp(result.profit)}</strong> on eBay
                    {result.vintedProfit !== null && (
                      <>, <span className="tabular-nums">{formatGbp(result.vintedProfit)}</span> on Vinted</>
                    )}
                  </span>
                </div>
                <p className="mt-2 text-xs text-zinc-400">
                  Resale about {formatGbp(result.resale)}, from {result.comps.count} eBay listings asking{" "}
                  {formatGbp(result.comps.low)} to {formatGbp(result.comps.high)} (median {formatGbp(result.comps.median)}).
                </p>
                {result.roughReasons?.length > 0 && (
                  <p className="mt-1 text-xs text-amber-200">Rough estimate: {result.roughReasons.join(", ")}.</p>
                )}
              </>
            )}
            {result.tooCheap && (
              <p className="mt-1 text-xs text-rose-300">
                Too cheap to trust: under half the cheapest similar listing on eBay. Fakes, parts and scams often look like this.
              </p>
            )}
            {result.oftenFaked && !result.tooCheap && (
              <p className="mt-1 text-xs text-amber-200">
                {result.oftenFaked} is often faked. Ask for photos of the caseback, movement and serial before paying, and pay
                through the site so you're covered.
              </p>
            )}
            {overBudget && <p className="mt-1 text-xs text-amber-200">That's over your {formatGbp(settings.maxBudget)} limit.</p>}
          </div>
        )}
      </form>
    </details>
  );
}
