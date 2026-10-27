"use client";

import { useState } from "react";
import { formatGbp, formatTimeLeft, hoursLeft } from "./format";

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

export default function AuctionCard({ item, now, onSetResale }) {
  const style = STATUS_STYLES[item.status];
  const hours = hoursLeft(item.endTime, now);
  const timeClass =
    hours < 1
      ? "bg-rose-500 text-white"
      : hours < 6
      ? "bg-rose-500/90 text-white"
      : hours < 24
      ? "bg-amber-400 text-amber-950"
      : "bg-zinc-950/80 text-zinc-100";

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-2xl bg-zinc-900 ring-1 ${style.ring}`}
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
          {formatTimeLeft(item.endTime, now)}
        </span>
        <span
          className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-medium ${style.badge}`}
        >
          {style.label}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div>
          <h3 className="line-clamp-2 text-sm leading-snug text-zinc-100">
            {item.title}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
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
            label="Cost now"
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
            hint={
              item.resaleSource === "manual"
                ? "your value"
                : item.comps
                ? `${item.comps.count} listings`
                : "no estimate"
            }
          />
          <Figure
            label="Profit now"
            value={formatGbp(item.profit)}
            valueClass={style.profit}
            // Early bids make huge returns look real, so cap the figure
            hint={item.roi === null ? "" : item.roi > 300 ? "300%+ return" : `${item.roi}% return`}
          />
        </dl>

        {item.maxBid !== null && <BidHeadroom item={item} />}

        <ResaleEditor item={item} onSetResale={onSetResale} />

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

function ResaleEditor({ item, onSetResale }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

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
        {item.resaleSource === "manual"
          ? "Change your resale value"
          : item.resale === null
          ? "Add your own resale value"
          : "Know better? Set your own resale value"}
      </button>
    );
  }

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const number = parseFloat(value);
        onSetResale(item.itemId, number > 0 ? number : undefined);
        setEditing(false);
      }}
    >
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
      {item.resaleSource === "manual" && (
        <button
          type="button"
          onClick={() => {
            onSetResale(item.itemId, undefined);
            setEditing(false);
          }}
          className="rounded-lg px-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          Reset
        </button>
      )}
    </form>
  );
}
