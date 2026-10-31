"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState, Stat } from "./Placeholders";
import { formatGbp } from "./format";
import { stockReminders } from "@/lib/stock";
import { weeklyReview } from "@/lib/review";
import { draftDescription, draftPrices, draftTitle } from "@/lib/listingDraft";
import { fetchPrices, titleModelKey } from "../client/priceCheck";
import { resalePercentFor } from "@/lib/profit";
import { REPORTING_AMOUNT, REPORTING_SALES, TRADING_ALLOWANCE, inTaxYear, platformReporting, salesTaxYears, taxYearSummary } from "@/lib/tax";
import { MIN_SALES_FOR_RATIO, PLATFORMS, pastSales, dealFees, dealProfit, daysToSell, isSold, saleRatio, summarise, toCsv } from "@/lib/dealLog";

// Watches you bought and sold: running profit, and what your real sale
// prices say about the "Expected sale price" setting
export default function DealLog({ dealBook, settings, onSettingsChange, openId, onFindDeals, models = [] }) {
  const { deals, logPurchase, updateDeal, removeDeal } = dealBook;
  const [open, setOpen] = useState(openId ?? null);
  useEffect(() => {
    if (openId) setOpen(openId);
  }, [openId]);

  const summary = useMemo(() => summarise(deals, settings), [deals, settings]);
  const ratio = useMemo(() => saleRatio(deals), [deals]);
  const reminders = useMemo(() => stockReminders(deals, settings), [deals, settings]);
  const review = useMemo(() => weeklyReview(deals, settings, { models }), [deals, settings, models]);

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

      <ReviewPanel review={review} />

      <TaxPanel deals={deals} settings={settings} />

      {reminders.length > 0 && (
        <Reminders
          reminders={reminders}
          onOpen={(id) => setOpen(id)}
          onDrop={(id, price) => updateDeal(id, { listedAt: price, listedOn: today() })}
        />
      )}

      <StockValue deals={deals} settings={settings} />

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
            deals={deals}
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
        Your sales log is saved in this browser, and synced to your other devices when syncing is on. Download the
        CSV now and then as a backup, and for your tax records.{" "}
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

const today = () => new Date().toISOString().slice(0, 10);

// The last 7 and 30 days, best and worst brands, and price moves
function ReviewPanel({ review }) {
  const { week, month, best, worst, movers } = review;
  const anything = week.sold || week.bought || month.sold || month.bought || best || movers.rising.length || movers.falling.length;
  if (!anything) return null;
  return (
    <section className="mb-6 rounded-2xl bg-zinc-900/60 p-4 ring-1 ring-white/5">
      <h2 className="mb-3 text-sm font-medium text-zinc-100">Review</h2>
      <div className="grid gap-3 text-xs text-zinc-400 sm:grid-cols-2">
        <Period label="Last 7 days" period={week} />
        <Period label="Last 30 days" period={month} />
      </div>
      {(best || worst) && (
        <div className="mt-3 space-y-1 border-t border-white/5 pt-3 text-xs text-zinc-400">
          {best && (
            <p>
              <span className="text-emerald-300">Best brand:</span> {best.brand}, {formatGbp(best.average)} a watch across{" "}
              {best.count} sales{best.days !== null && `, ${best.days} days to sell`}.
            </p>
          )}
          {worst && (
            <p>
              <span className={worst.average > 0 ? "text-amber-300" : "text-rose-300"}>Weakest brand:</span> {worst.brand},{" "}
              {formatGbp(worst.average)} a watch across {worst.count} sales
              {worst.average <= 0 ? ". Consider dropping it from Top deals." : "."}
            </p>
          )}
        </div>
      )}
      {(movers.rising.length > 0 || movers.falling.length > 0) && (
        <div className="mt-3 space-y-1 border-t border-white/5 pt-3 text-xs text-zinc-400">
          {movers.rising.length > 0 && (
            <p>
              <span className="text-emerald-300">▲ Rising:</span>{" "}
              {movers.rising.map((model) => `${model.label} ${model.change.percent}%`).join(", ")}
            </p>
          )}
          {movers.falling.length > 0 && (
            <p>
              <span className="text-rose-300">▼ Falling:</span>{" "}
              {movers.falling.map((model) => `${model.label} ${model.change.percent}%`).join(", ")}
            </p>
          )}
          <p className="text-[11px] text-zinc-500">Asking prices over about 30 days, from the price index.</p>
        </div>
      )}
    </section>
  );
}

function Period({ label, period }) {
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-widest text-zinc-500">{label}</div>
      <p>
        Sold {period.sold}, profit{" "}
        <span className={`font-semibold tabular-nums ${period.profit >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
          {formatGbp(period.profit)}
        </span>
      </p>
      <p>
        Bought {period.bought}, spent <span className="tabular-nums text-zinc-200">{formatGbp(period.spent)}</span>
      </p>
    </div>
  );
}

// Shots that sell a watch: buyers want to see all of these
const PHOTO_SHOTS = [
  ["dial", "Dial, straight on"],
  ["angle", "Dial at an angle (crystal and lume)"],
  ["caseback", "Caseback"],
  ["crown", "Side with the crown"],
  ["otherSide", "Other side"],
  ["clasp", "Clasp or buckle"],
  ["bracelet", "Bracelet or strap, full length"],
  ["reference", "Reference or serial"],
  ["movement", "Movement, if the back is clear"],
  ["wrist", "On the wrist, for size"],
  ["extras", "Box, papers and spare links"],
  ["marks", "Any marks, close up"],
];

function PhotoChecklist({ photos, onChange }) {
  const [open, setOpen] = useState(false);
  const done = PHOTO_SHOTS.filter(([key]) => photos[key]).length;
  return (
    <div className="sm:col-span-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-zinc-200 ring-1 ring-white/15 hover:bg-white/5"
      >
        Photo checklist <span className="ml-1 tabular-nums text-zinc-400">{done}/{PHOTO_SHOTS.length}</span>
      </button>
      {open && (
        <div className="mt-2 rounded-xl bg-black/20 p-3 ring-1 ring-white/5">
          <p className="mb-2 text-[11px] text-zinc-500">
            Natural daylight, a plain background, and no flash on the crystal. Clear photos of every side sell faster and
            for more.
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {PHOTO_SHOTS.map(([key, label]) => (
              <li key={key}>
                <label className="flex items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={Boolean(photos[key])}
                    onChange={(e) => onChange({ ...photos, [key]: e.target.checked })}
                    className="accent-emerald-500"
                  />
                  {label}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Takings against the trading allowance, sales per site against the
// reporting thresholds, and a CSV per tax year
function TaxPanel({ deals, settings }) {
  const summary = useMemo(() => taxYearSummary(deals, settings), [deals, settings]);
  const sites = useMemo(() => platformReporting(deals), [deals]);
  const years = useMemo(() => salesTaxYears(deals), [deals]);
  const [chosen, setChosen] = useState(null);
  if (!years.length && !summary.sales) return null;

  const share = Math.min(summary.takings / TRADING_ALLOWANCE, 1) * 100;
  const year = years.find((entry) => entry.label === chosen) ?? years[0];

  function download() {
    if (!year) return;
    const blob = new Blob([toCsv(deals.filter((deal) => inTaxYear(deal, year)), settings)], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `watch-hunter-sales-${year.label.replace("/", "-")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const siteName = (key) => PLATFORMS.find((platform) => platform.key === key)?.label ?? "Elsewhere";

  return (
    <section className="mb-6 rounded-2xl bg-zinc-900/60 p-4 text-xs text-zinc-400 ring-1 ring-white/5">
      <h2 className="mb-2 text-sm font-medium text-zinc-100">Tax year {summary.year.label}</h2>
      <p>
        {summary.sales} {summary.sales === 1 ? "sale" : "sales"}, takings{" "}
        <span className="tabular-nums text-zinc-200">{formatGbp(summary.takings)}</span>, profit{" "}
        <span className={`tabular-nums ${summary.profit >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatGbp(summary.profit)}</span>.
      </p>
      <div className="mt-2">
        <div className="mb-1 flex justify-between">
          <span>Trading allowance</span>
          <span className="tabular-nums">
            {formatGbp(summary.takings)} of {formatGbp(TRADING_ALLOWANCE)}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
          <div className={`h-full rounded-full ${summary.overAllowance ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${share}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">
          {summary.overAllowance
            ? "Your takings are over £1,000 this tax year, so you'll likely need to register for Self Assessment and report the profit."
            : "Takings (what buyers paid, before costs) up to £1,000 in a tax year don't need reporting to HMRC."}
        </p>
      </div>
      {sites.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {sites.map((site) => (
            <li key={site.platform}>
              {siteName(site.platform)} this calendar year: {site.sales} {site.sales === 1 ? "sale" : "sales"},{" "}
              {formatGbp(site.takings)}
              {site.reported
                ? ". The site will report this to HMRC."
                : ` (reports at ${REPORTING_SALES} sales or about ${formatGbp(REPORTING_AMOUNT)}).`}
            </li>
          ))}
        </ul>
      )}
      {years.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={year?.label}
            onChange={(e) => setChosen(e.target.value)}
            aria-label="Tax year"
            className="rounded-full bg-black/30 px-3 py-1 text-xs text-zinc-200 ring-1 ring-white/10"
          >
            {years.map((entry) => (
              <option key={entry.label} value={entry.label}>
                {entry.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={download} className="rounded-full px-3 py-1 font-medium text-zinc-200 ring-1 ring-white/15 hover:bg-white/5">
            Download sales for this tax year
          </button>
        </div>
      )}
      <p className="mt-2 text-[11px] text-zinc-500">A guide, not tax advice. Check with HMRC or an accountant.</p>
    </section>
  );
}

// What unsold watches are worth at today's asking prices, after your
// expected sale price, against what you paid
function StockValue({ deals, settings }) {
  const unsold = useMemo(() => deals.filter((deal) => !isSold(deal)).slice(0, 20), [deals]);
  const [state, setState] = useState(null);
  if (!unsold.length) return null;

  async function value() {
    setState({ loading: true });
    try {
      const prices = await fetchPrices(unsold.map((deal) => deal.title || ""));
      const rows = unsold.map((deal, index) => {
        const stats = prices[index];
        const share = resalePercentFor({ title: deal.title, brand: deal.brand }, settings).percent;
        return { deal, worth: stats ? Math.round((stats.median * share) / 100) : null };
      });
      setState({ rows });
    } catch (err) {
      setState({ error: err.message });
    }
  }

  const priced = state?.rows?.filter((row) => row.worth !== null) ?? [];
  const worth = priced.reduce((total, row) => total + row.worth, 0);
  const paid = priced.reduce((total, row) => total + Number(row.deal.boughtFor || 0), 0);

  return (
    <section className="mb-6 rounded-2xl bg-zinc-900/60 p-4 text-xs text-zinc-400 ring-1 ring-white/5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-zinc-100">Stock value</h2>
        <button
          type="button"
          onClick={value}
          disabled={state?.loading}
          className="rounded-full px-3 py-1 font-medium text-emerald-300 ring-1 ring-emerald-400/40 hover:bg-emerald-400/10 disabled:opacity-50"
        >
          {state?.loading ? "Checking…" : state?.rows ? "Check again" : `Value ${unsold.length} unsold`}
        </button>
      </div>
      {!state && <p className="mt-1">What your unsold watches would fetch at today's eBay asking prices.</p>}
      {state?.error && <p className="mt-1 text-rose-300">{state.error}</p>}
      {state?.rows && (
        <>
          <p className="mt-2 text-zinc-300">
            {priced.length ? (
              <>
                Worth about <strong className="tabular-nums text-zinc-50">{formatGbp(worth)}</strong> against{" "}
                {formatGbp(paid)} paid:{" "}
                <span className={worth - paid >= 0 ? "text-emerald-300" : "text-rose-300"}>
                  {worth - paid >= 0 ? "+" : ""}
                  {formatGbp(worth - paid)}
                </span>{" "}
                before fees.
              </>
            ) : (
              "None of these could be priced from current listings."
            )}
            {priced.length < state.rows.length && ` ${state.rows.length - priced.length} couldn't be priced.`}
          </p>
          <ul className="mt-2 space-y-1">
            {state.rows.map(({ deal, worth: each }) => (
              <li key={deal.id} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{deal.title || "Untitled watch"}</span>
                <span className="shrink-0 tabular-nums">
                  {each === null ? "no price" : `${formatGbp(each)} (paid ${formatGbp(Number(deal.boughtFor) || 0)})`}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-zinc-500">
            Uses your expected sale price ({settings.resalePercent}%, or your brand figures) on the median asking price.
          </p>
        </>
      )}
    </section>
  );
}

// Watches that need listing, or a price cut
function Reminders({ reminders, onOpen, onDrop }) {
  return (
    <section className="mb-6 rounded-2xl bg-amber-400/10 p-4 text-sm text-amber-100 ring-1 ring-amber-400/20">
      <h2 className="mb-2 font-medium">
        {reminders.length} {reminders.length === 1 ? "watch needs" : "watches need"} attention
      </h2>
      <ul className="space-y-2 text-xs">
        {reminders.map(({ deal, kind, days, suggestion }) => (
          <li key={deal.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 flex-1">
              <span className="font-medium text-amber-50">{deal.title || "Untitled watch"}</span>
              {kind === "unlisted"
                ? ` · bought ${days} days ago and not listed yet`
                : suggestion
                ? ` · listed ${days} days at ${formatGbp(Number(deal.listedAt))} without selling`
                : ` · listed ${days} days at break-even without selling. Try another site, or hold it.`}
            </span>
            {kind === "stale" && suggestion ? (
              <button
                type="button"
                onClick={() => onDrop(deal.id, suggestion)}
                className="rounded-full bg-amber-300 px-3 py-1 font-semibold text-amber-950 hover:bg-amber-200"
              >
                Drop to {formatGbp(suggestion)}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpen(deal.id)}
                className="rounded-full px-3 py-1 font-semibold ring-1 ring-amber-300/50 hover:bg-amber-300/10"
              >
                {kind === "unlisted" ? "Draft a listing" : "Open"}
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-amber-200/70">
        Suggested prices take 10% off and end in 9, never below what gets your money back after eBay fees. Updating
        the price here doesn't change eBay; change the listing there too.
      </p>
    </section>
  );
}

// A first draft of the listing for eBay or Vinted, to copy
function ListingDraft({ deal, deals, settings }) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState("ebay");
  const [copied, setCopied] = useState(null);
  // Today's asking prices for this model, once checked
  const [today, setToday] = useState(null);
  const sales = useMemo(() => pastSales(deals, deal.title, titleModelKey).filter((sale) => sale.id !== deal.id), [deals, deal]);

  async function checkToday() {
    setToday({ loading: true });
    try {
      const [stats] = await fetchPrices([deal.title]);
      setToday(stats ? { stats } : { none: true });
    } catch (err) {
      setToday({ error: err.message });
    }
  }

  if (!open) {
    return (
      <div className="sm:col-span-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-sky-200 ring-1 ring-sky-300/40 hover:bg-sky-300/10"
        >
          Draft a listing
        </button>
      </div>
    );
  }

  const title = draftTitle(deal);
  const text = draftDescription(deal, { platform });
  // Today's median, once checked, is a better guide than the one from when you bought
  const prices = draftPrices(today?.stats ? { ...deal, askingMedian: today.stats.median } : deal, settings);

  async function copy(label, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="rounded-xl bg-sky-400/10 p-3 text-xs text-sky-100 ring-1 ring-sky-400/20 sm:col-span-2">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex rounded-full p-0.5 ring-1 ring-sky-300/30" role="group" aria-label="Selling on">
          {[
            ["ebay", "eBay"],
            ["vinted", "Vinted"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={platform === key}
              onClick={() => setPlatform(key)}
              className={`rounded-full px-3 py-1 font-medium ${platform === key ? "bg-sky-300 text-sky-950" : "text-sky-200"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close draft" className="text-sky-200/70 hover:text-sky-100">
          ✕
        </button>
      </div>

      <div className="mb-3 rounded-lg bg-black/30 p-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sky-200/80">Today's asking prices</span>
          {!today?.loading && (
            <button type="button" onClick={checkToday} className="rounded-lg px-2 py-0.5 ring-1 ring-sky-300/40 hover:bg-sky-300/10">
              {today ? "Check again" : "Check now"}
            </button>
          )}
        </div>
        {today?.loading && <p className="mt-1 text-sky-200/70">Checking eBay…</p>}
        {today?.stats && (
          <p className="mt-1 text-sky-50">
            {formatGbp(today.stats.low)} to {formatGbp(today.stats.high)}, median{" "}
            <strong className="tabular-nums">{formatGbp(today.stats.median)}</strong>, across {today.stats.count} pre-owned listings
            {today.stats.matchedBy === "name" ? " matched by model name" : ""}. Prices below use this.
          </p>
        )}
        {today?.none && <p className="mt-1 text-sky-200/70">Too few listings of this model to price it. Try the Sold link on eBay.</p>}
        {today?.error && <p className="mt-1 text-rose-300">{today.error}</p>}
        {sales.length > 0 && (
          <p className="mt-1.5 text-sky-200/80">
            You've sold this model before:{" "}
            {sales
              .slice(0, 3)
              .map((sale) => `${formatGbp(Number(sale.soldFor))}${sale.soldOn ? ` (${sale.soldOn})` : ""}`)
              .join(", ")}
            .
          </p>
        )}
      </div>

      {prices && (
        <p className="mb-3">
          {platform === "ebay" ? (
            <>
              List at <strong className="tabular-nums">{formatGbp(prices.ebay)}</strong> with offers on, and accept nothing
              under <strong className="tabular-nums">{formatGbp(prices.lowestOffer)}</strong>.
            </>
          ) : (
            <>
              List at <strong className="tabular-nums">{formatGbp(prices.vinted)}</strong>. Vinted buyers pay a protection fee
              on top, so a little under eBay sells faster.
            </>
          )}
        </p>
      )}

      <div className="mb-1 flex items-center justify-between">
        <span className="text-sky-200/80">Title ({title.length}/80)</span>
        <button type="button" onClick={() => copy("title", title)} className="rounded-lg px-2 py-0.5 ring-1 ring-sky-300/40 hover:bg-sky-300/10">
          {copied === "title" ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mb-3 rounded-lg bg-black/30 p-2 font-medium text-sky-50">{title}</p>

      <div className="mb-1 flex items-center justify-between">
        <span className="text-sky-200/80">Description: fill in the [brackets]</span>
        <button type="button" onClick={() => copy("text", text)} className="rounded-lg px-2 py-0.5 ring-1 ring-sky-300/40 hover:bg-sky-300/10">
          {copied === "text" ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="whitespace-pre-wrap rounded-lg bg-black/30 p-2 font-sans leading-relaxed text-sky-50">{text}</pre>
    </div>
  );
}

function sameBrandFigures(byBrand, current = {}) {
  return byBrand.length === Object.keys(current).length && byBrand.every((row) => current[row.brand] === row.percent);
}

function DealRow({ deal, deals, settings, open, onToggle, onChange, onRemove }) {
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
        <div className={`text-right text-sm font-semibold tabular-nums ${profit === null || Math.round(profit) === 0 ? "text-zinc-500" : profit > 0 ? "text-emerald-300" : "text-rose-300"}`}>
          {profit === null ? "Unsold" : Math.round(profit) === 0 ? "£0" : `${profit > 0 ? "+" : ""}${formatGbp(profit)}`}
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

          {!sold && (
            <>
              <div className="border-t border-white/5 pt-3 text-xs font-medium uppercase tracking-widest text-zinc-500 sm:col-span-2">
                Listing
              </div>
              <Field label="Listed on">
                <input type="date" value={deal.listedOn ?? ""} onChange={(e) => onChange({ listedOn: e.target.value })} className={INPUT} />
              </Field>
              <Money
                label="Listed at"
                value={deal.listedAt ?? ""}
                onChange={(listedAt) => onChange({ listedAt })}
                hint="So the app can remind you if it hasn't sold in three weeks."
              />
              <PhotoChecklist photos={deal.photos ?? {}} onChange={(photos) => onChange({ photos })} />
              <ListingDraft deal={deal} deals={deals} settings={settings} />
            </>
          )}

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
