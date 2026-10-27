"use client";

import { useState } from "react";
import { formatGbp, formatTimeLeft, hoursLeft } from "./format";
import { baseModel } from "@/lib/models";

const STATUS_STYLES = {
  deal: {
    ring: "ring-emerald-500/60",
    profit: "text-emerald-400",
    badge: "bg-emerald-500 text-emerald-950",
    label: "Deal",
  },
  thin: {
    ring: "ring-zinc-800",
    profit: "text-amber-400",
    badge: "bg-amber-400 text-amber-950",
    label: "Thin margin",
  },
  loss: {
    ring: "ring-zinc-800",
    profit: "text-rose-400",
    badge: "bg-zinc-700 text-zinc-200",
    label: "No profit",
  },
  unknown: {
    ring: "ring-zinc-800",
    profit: "text-zinc-500",
    badge: "bg-zinc-800 text-zinc-300",
    label: "Needs a price",
  },
};

const SELLER_STYLES = {
  trusted: { dot: "bg-emerald-400", text: "text-zinc-400" },
  caution: { dot: "bg-amber-400", text: "text-amber-300" },
  risky: { dot: "bg-rose-500", text: "text-rose-300" },
};

export default function AuctionCard({ item, now, onSetResale, saved, onToggleSave }) {
  const style = STATUS_STYLES[item.status];
  const hours = hoursLeft(item.endTime, now);
  // eBay stops returning a listing once it has ended
  const ended = item.ended || hours <= 0;
  const timeClass = ended
    ? "bg-zinc-700 text-zinc-200"
    : hours < 1
      ? "bg-rose-500 text-white"
      : hours < 6
      ? "bg-rose-500/90 text-white"
      : hours < 24
      ? "bg-amber-400 text-amber-950"
      : "bg-zinc-950/80 text-zinc-100";

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-2xl bg-zinc-900 ring-1 ${
        ended ? "ring-zinc-800 opacity-60" : style.ring
      }`}
    >
      <div className="relative aspect-[16/10] bg-zinc-800 sm:aspect-[4/3]">
        {item.image ? (
          <img
            src={item.image}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            No photo
          </div>
        )}

        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums ${timeClass}`}
        >
          {ended ? "Ended" : formatTimeLeft(item.endTime, now)}
        </span>
        {!ended && (
          <span
            className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-medium ${style.badge}`}
          >
            {style.label}
          </span>
        )}

        <button
          type="button"
          onClick={() => onToggleSave(item)}
          aria-pressed={saved}
          aria-label={saved ? "Remove from watchlist" : "Save to watchlist"}
          title={saved ? "Remove from watchlist" : "Save to watchlist"}
          className={`absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full ring-1 backdrop-blur transition ${
            saved
              ? "bg-emerald-500 text-emerald-950 ring-emerald-400"
              : "bg-zinc-950/70 text-zinc-100 ring-zinc-700 hover:bg-zinc-900"
          }`}
        >
          <BookmarkIcon filled={saved} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div>
          <h3 className="line-clamp-2 text-sm leading-snug text-zinc-100">
            {item.title}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            {item.brand && (
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">
                {item.brand}
              </span>
            )}
            {item.modelRef && (
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-zinc-300">
                {item.modelRef}
              </span>
            )}
            <span>
              {item.bidCount === 0
                ? "No bids yet"
                : `${item.bidCount} ${item.bidCount === 1 ? "bid" : "bids"}`}
            </span>
            {item.condition && <span>· {item.condition}</span>}
          </div>
        </div>

        <SellerLine seller={item.seller} check={item.sellerCheck} />

        <dl className="grid grid-cols-3 gap-2 text-center">
          <Figure
            label={ended ? "Last seen" : "Cost now"}
            value={formatGbp(item.totalCost)}
            hint={
              item.postage === null
                ? "postage unknown"
                : item.postage === 0
                ? "free postage"
                : `incl. ${formatGbp(item.postage, { pence: true })} post`
            }
          />
          <Figure
            label="Resale"
            value={formatGbp(item.resale)}
            hint={resaleHint(item)}
          />
          <Figure
            label={ended ? "Profit" : "Profit now"}
            value={formatGbp(item.profit)}
            valueClass={style.profit}
            // Early bids make huge returns look real, so cap the figure
            hint={item.roi === null ? "" : item.roi > 300 ? "300%+ return" : `${item.roi}% return`}
          />
        </dl>

        {ended ? (
          <p className="text-xs text-zinc-500">
            This auction has ended. Figures use the last bid Watch Hunter saw.
          </p>
        ) : (
          <>
            {item.maxBid !== null && <BidHeadroom item={item} />}
            <ResaleEditor item={item} onSetResale={onSetResale} />
            <PriceChecks item={item} />
          </>
        )}

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto block rounded-xl bg-white py-2.5 text-center text-sm font-medium text-zinc-950 transition hover:bg-zinc-200"
        >
          View on eBay
        </a>
      </div>
    </article>
  );
}

function BookmarkIcon({ filled }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 3h12v18l-6-4.5L6 21z" />
    </svg>
  );
}

function SellerLine({ seller, check }) {
  const style = SELLER_STYLES[check.level];
  const feedback =
    seller?.feedbackScore != null
      ? `${seller.feedbackScore.toLocaleString("en-GB")} feedback${
          seller.feedbackPercentage != null ? ` · ${seller.feedbackPercentage}%` : ""
        }`
      : "feedback not shown";

  return (
    <div
      className={`rounded-xl px-3 py-2 text-xs ${
        check.level === "risky"
          ? "bg-rose-950/50 ring-1 ring-rose-500/40"
          : check.level === "caution"
          ? "bg-amber-950/30 ring-1 ring-amber-500/30"
          : "bg-zinc-950/60"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
        <span className="truncate text-zinc-200">
          {seller?.username ?? "Unknown seller"}
        </span>
        <span className="ml-auto shrink-0 tabular-nums text-zinc-400">
          {feedback}
        </span>
      </div>
      {check.level !== "trusted" && (
        <div className={`mt-1 ${style.text}`}>
          {check.level === "risky" ? "Risky seller: " : "Check this seller: "}
          {check.reasons.join(", ")}
        </div>
      )}
    </div>
  );
}

function Figure({ label, value, hint, valueClass = "text-zinc-100" }) {
  return (
    <div className="rounded-xl bg-zinc-950/60 px-2 py-2.5">
      <dt className="text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className={`mt-0.5 text-lg font-semibold tabular-nums ${valueClass}`}>
        {value}
      </dd>
      {hint && <dd className="text-[11px] text-zinc-500">{hint}</dd>}
    </div>
  );
}

// Shows how far the current bid is from the most you can pay
function BidHeadroom({ item }) {
  const headroom = item.maxBid - item.currentBid;
  const used =
    item.maxBid > 0 ? Math.min((item.currentBid / item.maxBid) * 100, 100) : 100;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="text-zinc-400">
          Bid up to{" "}
          <span className="font-semibold text-zinc-100">
            {formatGbp(item.maxBid)}
          </span>
        </span>
        <span className={headroom > 0 ? "text-emerald-400" : "text-rose-400"}>
          {headroom > 0
            ? `${formatGbp(headroom)} headroom`
            : "Already past your limit"}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full ${
            headroom > 0 ? "bg-emerald-500" : "bg-rose-500"
          }`}
          style={{ width: `${used}%` }}
        />
      </div>
    </div>
  );
}

// Words that say nothing about which watch it is
const FILLER_WORDS = /^(mens|men's|ladies|womens|women's|gents|vintage|rare|watch|wristwatch|automatic|quartz|new|used|boxed|genuine|original|stunning|superb|lovely|nice|great|wow)$/i;

// What to search other sites for: the model reference when there is one,
// otherwise the first few meaningful words of the title
function searchQuery(item) {
  if (item.modelRef) return baseModel(item.modelRef);

  return item.title
    .replace(/[^\p{L}\p{N}&' -]/gu, " ")
    .split(/\s+/)
    // Single letters are usually leftovers like the L and K of "L@@K"
    .filter((word) => word && !FILLER_WORDS.test(word) && (word.length > 1 || /\d/.test(word)))
    .slice(0, 4)
    .join(" ");
}

function PriceChecks({ item }) {
  const query = searchQuery(item);
  if (!query) return null;

  const sites = [
    {
      name: "Chrono24",
      url: `https://www.chrono24.co.uk/search/index.htm?${new URLSearchParams({ query, dosearch: "true" })}`,
    },
    {
      name: "Vinted",
      url: `https://www.vinted.co.uk/catalog?${new URLSearchParams({ search_text: query })}`,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-zinc-500">Check prices:</span>
      {sites.map((site) => (
        <a
          key={site.name}
          href={site.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`Search ${site.name} for ${query}`}
          className="rounded-full px-2.5 py-1 text-zinc-300 ring-1 ring-zinc-700 transition hover:text-zinc-100 hover:ring-zinc-500"
        >
          {site.name} ↗
        </a>
      ))}
    </div>
  );
}

const CONDITION_NAMES = { NEW: "new", USED: "pre-owned" };

function resaleHint(item) {
  if (item.resaleSource === "listing") return "your value";
  if (item.resaleSource === "model") return `your ${baseModel(item.modelRef)} value`;
  if (!item.comps) return "no estimate";

  const condition = CONDITION_NAMES[item.comps.condition];
  return `${item.comps.count} ${condition ? `${condition} ` : ""}listings`;
}

function ResaleEditor({ item, onSetResale }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const custom = item.resaleSource === "listing" || item.resaleSource === "model";
  const model = item.modelRef ? baseModel(item.modelRef) : null;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(item.resale ? String(Math.round(item.resale)) : "");
          setEditing(true);
        }}
        className="text-left text-xs text-zinc-400 underline decoration-zinc-700 underline-offset-4 hover:text-zinc-200"
      >
        {custom
          ? `Change your resale value${model ? ` for ${model}` : ""}`
          : item.resale === null
          ? `Add your own resale value${model ? ` for ${model}` : ""}`
          : `Know better? Set your own value${model ? ` for ${model}` : ""}`}
      </button>
    );
  }

  return (
    <form
      className="space-y-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        const number = parseFloat(value);
        onSetResale(item, number > 0 ? number : undefined);
        setEditing(false);
      }}
    >
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
            £
          </span>
          <input
            autoFocus
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-lg bg-zinc-800 py-1.5 pl-7 pr-2 text-sm text-zinc-100 outline-none ring-1 ring-zinc-700 focus:ring-emerald-500"
            placeholder="Resale value"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-emerald-500 px-3 text-sm font-medium text-emerald-950"
        >
          Save
        </button>
        {custom && (
          <button
            type="button"
            onClick={() => {
              onSetResale(item, undefined);
              setEditing(false);
            }}
            className="rounded-lg px-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            Reset
          </button>
        )}
      </div>
      {model && (
        <p className="text-[11px] text-zinc-500">
          Used for every {model} listing from now on.
        </p>
      )}
    </form>
  );
}
