"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState, Stat } from "./Placeholders";
import { formatGbp } from "./format";
import { MIN_SALES_FOR_RATIO, PLATFORMS, dealFees, dealProfit, daysToSell, isSold, saleRatio, summarise, toCsv } from "@/lib/dealLog";

// Watches you bought and sold: running profit, and what your real sale
// prices say about the "Expected sale price" setting
export default function DealLog({ dealBook, settings, onSettingsChange, openId, onFindDeals }) {
  const { deals, logPurchase, updateDeal, removeDeal } = dealBook;
  const [open, setOpen] = useState(openId ?? null);
  useEffect(() => {
    if (openId) setOpen(openId);
  }, [openId]);

  const summary = useMemo(() => summarise(deals, settings), [deals, settings]);
  const ratio = useMemo(() => saleRatio(deals), [deals]);

  function addManual() {
    setOpen(logPurchase({ title: "" }));
  }

  function download() {
    const blob = new Blob([toCsv(deals, settings)], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `watch-hunter-deals-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (!deals.length) {
    return (
      <EmptyState
        title="No deals logged yet."
        body='When you win or buy a watch, tap "I bought this" on it in your watchlist, or add it here. Log the sale when it goes, and the app learns what your watches really sell for.'
        action="Add a watch"
        onAction={addManual}
      />
    );
  }

  return (
    <section>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Profit so far" value={formatGbp(summary.profit)} accent={summary.profit > 0} note={`${summary.sold} sold`} />
        <Stat label="Sales" value={formatGbp(summary.revenue)} />
        <Stat label="In stock" value={summary.inStock} note={summary.inStock ? `${formatGbp(summary.stockCost)} paid` : null} />
        <Stat label="Days to sell" value={summary.medianDays ?? "–"} note={summary.medianDays !== null ? "median" : null} />
      </div>

      <RatioPanel ratio={ratio} settings={settings} onSettingsChange={onSettingsChange} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-zinc-300">
          {deals.length} {deals.length === 1 ? "watch" : "watches"}
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={download}
            className="rounded-full px-3.5 py-2 text-sm font-medium text-zinc-300 ring-1 ring-white/10 hover:bg-white/5"
          >
            Download CSV
          </button>
          <button
            type="button"
            onClick={addManual}
            className="rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200"
          >
            Add a watch
          </button>
        </div>
      </div>

      <ul className="space-y-2">
        {deals.map((deal) => (
          <DealRow
            key={deal.id}
            deal={deal}
            settings={settings}
            open={open === deal.id}
            onToggle={() => setOpen((current) => (current === deal.id ? null : deal.id))}
            onChange={(changes) => updateDeal(deal.id, changes)}
            onRemove={() => {
              if (window.confirm("Delete this watch from your deal log?")) removeDeal(deal.id);
            }}
          />
        ))}
      </ul>

      <p className="mt-6 text-xs text-zinc-500">
        Your deal log is kept in this browser only. Download the CSV now and then as a backup, and for your tax
        records.{" "}
        <button type="button" onClick={onFindDeals} className="text-emerald-300 hover:text-emerald-200">
          Find more deals
        </button>
      </p>
    </section>
  );
}

function RatioPanel({ ratio, settings, onSettingsChange }) {
  if (ratio.percent === null) {
    return (
      <div className="mb-6 rounded-2xl bg-zinc-900/60 p-4 text-sm text-zinc-400 ring-1 ring-white/5">
        After {MIN_SALES_FOR_RATIO} sales of watches the app had an estimate for, this shows what yours really sell for
        compared with eBay asking prices, so you can set "Expected sale price" from real results.
        {ratio.count > 0 && ` ${ratio.count} so far.`}
      </div>
    );
  }

  const current = settings.resalePercent;
  const off = ratio.percent - current;
  return (
    <div className="mb-6 rounded-2xl bg-sky-400/10 p-4 text-sm text-sky-100 ring-1 ring-sky-400/20">
      <p>
        Across {ratio.count} sales, your watches sold for <strong className="tabular-nums">{ratio.percent}%</strong> of the
        median asking price when you bought them. Settings assume {current}%.
      </p>
      {ratio.byBrand.length > 0 && (
        <p className="mt-1 text-xs text-sky-200/80">
          {ratio.byBrand.map((row) => `${row.brand} ${row.percent}% (${row.count})`).join(" · ")}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {off !== 0 && (
          <button
            type="button"
            onClick={() => onSettingsChange({ ...settings, resalePercent: ratio.percent })}
            className="rounded-full bg-sky-300 px-3.5 py-1.5 text-sm font-semibold text-sky-950 hover:bg-sky-200"
          >
            Use {ratio.percent}% for estimates
          </button>
        )}
        {ratio.byBrand.length > 0 && !sameBrandFigures(ratio.byBrand, settings.brandResalePercent) && (
          <button
            type="button"
            onClick={() =>
              onSettingsChange({
                ...settings,
                brandResalePercent: Object.fromEntries(ratio.byBrand.map((row) => [row.brand, row.percent])),
              })
            }
            className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-sky-100 ring-1 ring-sky-300/50 hover:bg-sky-300/10"
          >
            Use my figure for {ratio.byBrand.map((row) => row.brand).join(", ")}
          </button>
        )}
      </div>
      {Object.keys(settings.brandResalePercent ?? {}).length > 0 && (
        <p className="mt-2 text-xs text-sky-200/80">
          Estimates now use{" "}
          {Object.entries(settings.brandResalePercent)
            .map(([brand, percent]) => `${percent}% for ${brand}`)
            .join(", ")}
          , and {current}% for other brands.{" "}
          <button
            type="button"
            onClick={() => onSettingsChange({ ...settings, brandResalePercent: {} })}
            className="underline hover:text-sky-100"
          >
            Stop using brand figures
          </button>
        </p>
      )}
    </div>
  );
}

function sameBrandFigures(byBrand, current = {}) {
  return byBrand.length === Object.keys(current).length && byBrand.every((row) => current[row.brand] === row.percent);
}

function DealRow({ deal, settings, open, onToggle, onChange, onRemove }) {
  const sold = isSold(deal);
  const profit = dealProfit(deal, settings);
  const days = daysToSell(deal);

  return (
    <li className="overflow-hidden rounded-2xl bg-zinc-900/60 ring-1 ring-white/5">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 p-3 text-left">
        {deal.image ? (
          <img src={deal.image} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="h-12 w-12 shrink-0 rounded-xl bg-zinc-800" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-zinc-100">{deal.title || "Untitled watch"}</div>
          <div className="text-xs text-zinc-500">
            Bought {formatGbp(Number(deal.boughtFor) || 0)}
            {sold ? ` · sold ${formatGbp(Number(deal.soldFor))}${days !== null ? ` after ${days} ${days === 1 ? "day" : "days"}` : ""}` : " · in stock"}
          </div>
        </div>
        <div className={`text-right text-sm font-semibold tabular-nums ${profit === null ? "text-zinc-500" : profit >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
          {profit === null ? "Unsold" : `${profit > 0 ? "+" : ""}${formatGbp(profit)}`}
        </div>
      </button>

      {open && (
        <div className="grid gap-3 border-t border-white/5 p-3 sm:grid-cols-2">
          <Field label="Watch" wide>
            <input type="text" value={deal.title} onChange={(e) => onChange({ title: e.target.value })} className={INPUT} />
          </Field>
          <Field label="Brand">
            <input type="text" value={deal.brand} onChange={(e) => onChange({ brand: e.target.value })} className={INPUT} />
          </Field>
          <Field label="Bought on">
            <input type="date" value={deal.boughtOn} onChange={(e) => onChange({ boughtOn: e.target.value })} className={INPUT} />
          </Field>
          <Money label="Paid, including postage" value={deal.boughtFor} onChange={(boughtFor) => onChange({ boughtFor })} />
          <Money
            label="Asking median when bought"
            value={deal.askingMedian ?? ""}
            onChange={(askingMedian) => onChange({ askingMedian: askingMedian === "" ? null : askingMedian })}
            hint="Filled in from the app's estimate. Used to check your expected sale price."
          />

          <div className="border-t border-white/5 pt-3 text-xs font-medium uppercase tracking-widest text-zinc-500 sm:col-span-2">
            Sale
          </div>
          <Field label="Sold on">
            <input type="date" value={deal.soldOn} onChange={(e) => onChange({ soldOn: e.target.value })} className={INPUT} />
          </Field>
          <Field label="Sold through">
            <select value={deal.platform} onChange={(e) => onChange({ platform: e.target.value })} className={INPUT}>
              {PLATFORMS.map((platform) => (
                <option key={platform.key} value={platform.key}>
                  {platform.label}
                </option>
              ))}
            </select>
          </Field>
          <Money label="Sold for" value={deal.soldFor} onChange={(soldFor) => onChange({ soldFor })} />
          <Money
            label="Fees"
            value={deal.fees ?? ""}
            onChange={(fees) => onChange({ fees })}
            placeholder={sold ? dealFees({ ...deal, fees: "" }, settings).toFixed(2) : ""}
            hint={deal.platform === "ebay" ? `Leave blank for ${settings.sellingFeePercent}% of the sale` : "Leave blank for none"}
          />
          <Money label="Postage to buyer" value={deal.postageOut} onChange={(postageOut) => onChange({ postageOut })} />

          <div className="flex items-center justify-between gap-3 pt-1 sm:col-span-2">
            {deal.url ? (
              <a href={deal.url} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-400 hover:text-zinc-200">
                eBay listing ↗
              </a>
            ) : (
              <span />
            )}
            <button type="button" onClick={onRemove} className="text-xs text-rose-300 hover:text-rose-200">
              Delete
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

const INPUT =
  "w-full rounded-xl bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none ring-1 ring-white/10 focus:ring-emerald-400/50";

function Field({ label, wide, hint, children }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-xs text-zinc-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-zinc-500">{hint}</span>}
    </label>
  );
}

function Money({ label, value, onChange, placeholder, hint }) {
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">£</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className={`${INPUT} pl-7`}
        />
      </div>
    </Field>
  );
}
