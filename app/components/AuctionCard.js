"use client";

import { memo, useState } from "react";
import { formatGbp, formatTimeLeft, hoursLeft } from "./format";
import Gallery from "./Gallery";
import { modelKey } from "@/lib/models";
import { cautionWords } from "@/lib/wording";
import { gradeLabel } from "@/lib/condition";
import { ebayImage } from "@/lib/images";
import { niche } from "@/lib/niche";

const STATUS_STYLES = {
  deal: {
    glow: "ring-emerald-400/40 shadow-[0_0_40px_-12px_rgba(16,185,129,0.45)]",
    profit: "text-emerald-300",
    chip: "bg-emerald-400 text-emerald-950",
    label: "Deal",
  },
  thin: {
    glow: "ring-white/5",
    profit: "text-amber-300",
    chip: "bg-amber-300 text-amber-950",
    label: "Thin margin",
  },
  check: {
    glow: "ring-amber-400/30",
    profit: "text-amber-200",
    chip: "bg-amber-300 text-amber-950",
    label: "Check value",
  },
  loss: {
    glow: "ring-white/5",
    profit: "text-rose-300",
    chip: "bg-zinc-800/90 text-zinc-200",
    label: "No profit",
  },
  unknown: {
    glow: "ring-white/5",
    profit: "text-zinc-400",
    chip: "bg-zinc-800/90 text-zinc-300",
    label: "Needs a price",
  },
};

const SELLER_STYLES = {
  trusted: { dot: "bg-emerald-400", text: "text-zinc-400" },
  caution: { dot: "bg-amber-400", text: "text-amber-300" },
  risky: { dot: "bg-rose-500", text: "text-rose-300" },
};

// Memoised: a card only redraws when its listing, save state or the clock
// changes, not on every keystroke elsewhere on the page
export default memo(AuctionCard);

function AuctionCard({ item, now, onSetResale, saved, onToggleSave, onLogPurchase }) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const style = STATUS_STYLES[item.status];
  const isBuyItNow = item.listingType === "BUY_IT_NOW";
  const hours = hoursLeft(item.endTime, now);
  // eBay stops returning a listing once it has ended or sold; Buy It Now
  // listings can run with no end time at all
  const ended = item.ended || (!isBuyItNow && hours <= 0);
  const images = item.images?.length ? item.images : item.image ? [item.image] : [];

  return (
    <article
      className={`group flex flex-col overflow-hidden rounded-3xl bg-zinc-900/70 ring-1 backdrop-blur transition duration-300 hover:-translate-y-0.5 ${
        ended ? "opacity-60 ring-white/5" : style.glow
      }`}
    >
      <div className="relative aspect-[16/11] overflow-hidden bg-zinc-800">
        {images.length ? (
          <button
            type="button"
            onClick={() => setGalleryOpen(true)}
            className="block h-full w-full"
            aria-label={`Open ${images.length} ${images.length === 1 ? "photo" : "photos"}`}
          >
            <ListingPhoto url={images[0]} />
          </button>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            No photo
          </div>
        )}

        {/* Keeps the overlaid text readable on light photos */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/10 to-zinc-950/40" />

        <div className="pointer-events-none absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
          <TimePill item={item} hours={hours} ended={ended} isBuyItNow={isBuyItNow} now={now} />
          {!ended && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold shadow-lg ${style.chip}`}>
              {style.label}
            </span>
          )}
        </div>

        <div className="pointer-events-none absolute bottom-3 left-4 right-14">
          {/* A shaky estimate shouldn't headline the card */}
          {item.profit !== null && !ended && item.status === "check" && (
            <div className="text-xl font-semibold text-amber-200 drop-shadow">
              {item.tooCheap ? "Too cheap to trust" : "Estimate unsure"}
            </div>
          )}
          {item.profit !== null && !ended && item.status !== "check" && (
            <>
              <div className={`text-3xl font-bold tracking-tight tabular-nums drop-shadow ${style.profit}`}>
                {item.profit > 0 ? "+" : ""}
                {formatGbp(item.profit)}
              </div>
              <div className="text-[11px] font-medium uppercase tracking-widest text-zinc-300/80">
                {isBuyItNow ? "profit at this price" : "profit at current bid"}
              </div>
            </>
          )}
        </div>

        {images.length > 1 && (
          <span className="pointer-events-none absolute bottom-14 right-3 flex items-center gap-1 rounded-full bg-zinc-950/70 px-2 py-0.5 text-[11px] text-zinc-200 backdrop-blur">
            <PhotosIcon />
            {images.length}
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
              ? "bg-emerald-400 text-emerald-950 ring-emerald-300"
              : "bg-zinc-950/60 text-zinc-100 ring-white/15 hover:bg-zinc-900"
          }`}
        >
          <BookmarkIcon filled={saved} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3.5 p-4">
        <div>
          <h3 className="line-clamp-2 text-[15px] font-medium leading-snug text-zinc-50">
            {item.title}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
            {item.brand && <Chip tone="emerald">{item.brand}</Chip>}
            {item.modelRef && <Chip mono>{item.modelRef}</Chip>}
            {!item.modelRef && item.modelName && <Chip>{item.modelName}</Chip>}
            <span className="px-0.5">
              {isBuyItNow
                ? item.bestOffer
                  ? "Accepts offers"
                  : "Fixed price"
                : item.bidCount === 0
                ? "No bids yet"
                : `${item.bidCount} ${item.bidCount === 1 ? "bid" : "bids"}`}
            </span>
            {item.condition && <span>· {item.condition}</span>}
            {item.conditionCheck?.from === "title" && (
              <span title="eBay's condition doesn't give a grade, so this comes from the title">
                · title says {gradeLabel(item.conditionCheck.grade).toLowerCase()}
              </span>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-3 divide-x divide-white/5 rounded-2xl bg-black/30 ring-1 ring-white/5">
          <Figure
            label={isBuyItNow ? "Price" : ended ? "Last seen" : "Cost now"}
            value={formatGbp(item.totalCost)}
            hint={
              item.postage === null
                ? "postage unknown"
                : item.postage === 0
                ? "free postage"
                : `incl. ${formatGbp(item.postage, { pence: true })} post`
            }
          />
          <Figure label="Resale" value={formatGbp(item.resale)} hint={resaleHint(item)} />
          <Figure
            label="Return"
            value={item.roi === null ? "–" : item.roi > 300 ? "300%+" : `${item.roi}%`}
            valueClass={style.profit}
            hint={item.profit === null ? "" : `${formatGbp(item.profit)} profit`}
          />
        </dl>

        {item.comps && <PriceRange comps={item.comps} />}

        <SellerLine seller={item.seller} check={item.sellerCheck} />
        {!ended && <FakeChecks item={item} />}
        <WordingNote title={item.title} />
        {!ended && item.overlooked?.length > 0 && <OverlookedNote reasons={item.overlooked} />}
        {item.roughReasons?.length > 0 && <RoughNote reasons={item.roughReasons} />}

        {ended ? (
          <p className="text-xs text-zinc-500">
            {isBuyItNow
              ? "This listing has sold or ended."
              : `This auction has ended. Figures use the last bid ${niche.appName} saw.`}
          </p>
        ) : (
          <>
            {/* A limit from a shaky estimate could cost real money */}
            {item.maxBid !== null && !item.roughReasons?.length && !item.tooCheap && (
              isBuyItNow ? <OfferLimit item={item} /> : <BidHeadroom item={item} />
            )}
            <ResaleEditor item={item} onSetResale={onSetResale} />
          </>
        )}

        <div className="mt-auto flex items-center gap-2 pt-1">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-300 py-2.5 text-center text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/10 transition hover:brightness-110"
          >
            {ended ? "View on eBay" : isBuyItNow ? "Buy on eBay" : "Bid on eBay"}
          </a>
          {!ended && <PriceChecks item={item} />}
        </div>
        {onLogPurchase && (
          <button
            type="button"
            onClick={() => onLogPurchase(item)}
            className="-mt-1 self-start text-xs font-medium text-emerald-300 hover:text-emerald-200"
          >
            I bought this: add to my sales log
          </button>
        )}
      </div>

      {galleryOpen && (
        <Gallery images={images} title={item.title} onClose={() => setGalleryOpen(false)} />
      )}
    </article>
  );
}

function TimePill({ item, hours, ended, isBuyItNow, now }) {
  if (ended) {
    return <Pill className="bg-zinc-800/90 text-zinc-200">Ended</Pill>;
  }
  if (isBuyItNow) {
    return (
      <Pill className="bg-sky-400/90 text-sky-950">
        Buy It Now{item.bestOffer ? " · offers" : ""}
      </Pill>
    );
  }
  const tone =
    hours < 1
      ? "bg-rose-500 text-white animate-pulse"
      : hours < 6
      ? "bg-rose-500/90 text-white"
      : hours < 24
      ? "bg-amber-300 text-amber-950"
      : "bg-zinc-950/70 text-zinc-100 backdrop-blur";
  return <Pill className={`tabular-nums ${tone}`}>{formatTimeLeft(item.endTime, now)}</Pill>;
}

function Pill({ className, children }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold shadow-lg ${className}`}>
      {children}
    </span>
  );
}

function Chip({ children, tone, mono }) {
  return (
    <span
      className={`rounded-md px-1.5 py-0.5 ${mono ? "font-mono" : ""} ${
        tone === "emerald" ? "bg-emerald-400/15 text-emerald-300" : "bg-white/5 text-zinc-300"
      }`}
    >
      {children}
    </span>
  );
}

// Cards are at most about 380px wide, so 500px suits most screens and
// 1600px covers high-density ones. Falls back to eBay's own URL if a
// bigger copy won't load.
function ListingPhoto({ url }) {
  const [failed, setFailed] = useState(false);
  const large = ebayImage(url, 1600);
  const upgraded = !failed && large !== url;

  return (
    <img
      src={upgraded ? ebayImage(url, 500) : url}
      srcSet={upgraded ? `${ebayImage(url, 500)} 500w, ${large} 1600w` : undefined}
      sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
      alt=""
      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
      loading="lazy"
      onError={() => setFailed(true)}
    />
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

function PhotosIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M21 16l-5-5-8 8" />
    </svg>
  );
}

function Note({ tone = "amber", children }) {
  const tones = {
    amber: "bg-amber-400/10 text-amber-200 ring-amber-400/20",
    rose: "bg-rose-500/10 text-rose-200 ring-rose-400/25",
    sky: "bg-sky-400/10 text-sky-200 ring-sky-400/20",
  };
  return <div className={`rounded-xl px-3 py-2 text-xs leading-relaxed ring-1 ${tones[tone]}`}>{children}</div>;
}

function WordingNote({ title }) {
  const words = cautionWords(title);
  if (!words.length) return null;

  return (
    <Note>Read the listing first: it says {words.map((word) => `"${word}"`).join(", ")}</Note>
  );
}

// Fewer buyers seeing a listing can mean fewer bids and a lower price
function OverlookedNote({ reasons }) {
  const text = reasons.length > 1 ? `${reasons.slice(0, -1).join(", ")} and ${reasons.at(-1)}` : reasons[0];
  return <Note tone="sky">Fewer buyers may spot this: {text}.</Note>;
}

// Spread of the Buy It Now prices behind the estimate
function PriceRange({ comps }) {
  const condition = CONDITION_NAMES[comps.condition];

  return (
    <p className="-mt-1 text-[11px] leading-relaxed text-zinc-500">
      Asking prices{" "}
      <span className="tabular-nums text-zinc-300">
        {formatGbp(comps.low)} to {formatGbp(comps.high)}
      </span>{" "}
      across {comps.count} {condition ? `${condition} ` : ""}listings
      {comps.matchedBy === "name" && " matched by model name"}
      {comps.ignored > 0 &&
        `, ${comps.ignored} very high or low ${comps.ignored === 1 ? "price" : "prices"} ignored`}
    </p>
  );
}

// Warning signs of a fake, and eBay's own check where the listing has one
function FakeChecks({ item }) {
  return (
    <>
      {niche.everyListingNote && <Note>{niche.everyListingNote}</Note>}
      {item.authenticityGuarantee && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200 ring-1 ring-emerald-400/20">
          <ShieldIcon />
          <span>
            <span className="font-semibold">Authenticity Guarantee.</span> eBay's experts check it before it reaches you.
          </span>
        </div>
      )}
      {item.tooCheap && (
        <Note tone="rose">
          Too cheap to trust: {formatGbp(item.totalCost)} is under half the cheapest of {item.comps.count} similar
          listings ({formatGbp(item.comps.low)}). That usually means a fake, a part or a mistake. Before buying,{" "}
          {niche.fakeAdvice}, and only pay through eBay.
        </Note>
      )}
      {/* Bikes' frame number note already covers this */}
      {!item.tooCheap && item.oftenFaked && !item.authenticityGuarantee && !niche.everyListingNote && (
        <Note>
          {item.oftenFaked} is often faked. Before bidding, {niche.fakeAdvice}, and only pay through eBay.
        </Note>
      )}
    </>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RoughNote({ reasons }) {
  return (
    <Note>
      Rough estimate: {reasons.join(", ")}. Check {niche.roughCheck} before trusting this profit, then set
      your own value to see a limit.
    </Note>
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

  const body = (
    <>
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
        <span className="truncate text-zinc-300">{seller?.username ?? "Unknown seller"}</span>
        <span className="ml-auto shrink-0 tabular-nums text-zinc-500">{feedback}</span>
      </div>
      {check.level !== "trusted" && (
        <div className={`mt-1 ${style.text}`}>
          {check.level === "risky" ? "Risky seller: " : "Check this seller: "}
          {check.reasons.join(", ")}
        </div>
      )}
    </>
  );

  if (check.level === "trusted") return <div className="px-0.5 text-xs">{body}</div>;
  return <Note tone={check.level === "risky" ? "rose" : "amber"}>{body}</Note>;
}

function Figure({ label, value, hint, valueClass = "text-zinc-50" }) {
  return (
    <div className="px-2 py-2.5 text-center">
      <dt className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">{label}</dt>
      <dd className={`mt-0.5 text-lg font-semibold tabular-nums ${valueClass}`}>{value}</dd>
      {hint && <dd className="truncate text-[11px] text-zinc-500">{hint}</dd>}
    </div>
  );
}

// Shows how far the current bid is from the most you can pay
function BidHeadroom({ item }) {
  const headroom = item.maxBid - item.currentBid;
  const used = item.maxBid > 0 ? Math.min((item.currentBid / item.maxBid) * 100, 100) : 100;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="text-zinc-400">
          Bid up to <span className="font-semibold text-zinc-50">{formatGbp(item.maxBid)}</span>
          {item.budgetCapped && <span className="text-zinc-500"> · your spending limit</span>}
        </span>
        <span className={headroom > 0 ? "text-emerald-300" : "text-rose-300"}>
          {headroom > 0 ? `${formatGbp(headroom)} headroom` : "Already past your limit"}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full ${
            headroom > 0 ? "bg-gradient-to-r from-emerald-400 to-teal-300" : "bg-rose-500"
          }`}
          style={{ width: `${used}%` }}
        />
      </div>
    </div>
  );
}

// For Buy It Now, the limit is the most to pay before postage; only useful
// when the price is above it and the seller takes offers
function OfferLimit({ item }) {
  if (item.currentBid <= item.maxBid) return null;
  return (
    <p className="text-xs text-zinc-400">
      {item.budgetCapped ? (
        item.bestOffer ? (
          <>
            Over your spending limit. Offer up to{" "}
            <span className="font-semibold text-zinc-50">{formatGbp(item.maxBid)}</span> to stay within it.
          </>
        ) : (
          <>Over your spending limit.</>
        )
      ) : item.bestOffer ? (
        <>
          Offer up to <span className="font-semibold text-zinc-50">{formatGbp(item.maxBid)}</span>{" "}
          to clear your target profit.
        </>
      ) : (
        <>
          Your target profit needs a price of{" "}
          <span className="font-semibold text-zinc-50">{formatGbp(item.maxBid)}</span> or less.
        </>
      )}
    </p>
  );
}

// Words that say nothing about which model it is
const FILLER_WORDS = niche.fillerWords;

// What to search other sites for: the model reference or name when there is
// one, otherwise the first few meaningful words of the title
function searchQuery(item) {
  const key = modelKey(item);
  if (key) return key;

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

  const sites = niche.priceSites(query);

  return (
    <>
      {sites.map((site) => (
        <a
          key={site.name}
          href={site.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`Check prices for ${query} on ${site.name}`}
          className="rounded-xl px-3 py-2.5 text-xs font-medium text-zinc-300 ring-1 ring-white/10 transition hover:bg-white/5 hover:text-zinc-50"
        >
          {site.short} ↗
        </a>
      ))}
    </>
  );
}

const CONDITION_NAMES = { NEW: "new", USED: "pre-owned" };

function resaleHint(item) {
  if (item.resaleSource === "listing") return "your value";
  if (item.resaleSource === "model") return `your ${modelKey(item)} value`;
  if (!item.comps) return "no estimate";

  const condition = CONDITION_NAMES[item.comps.condition];
  return `${item.comps.count} ${condition ? `${condition} ` : ""}listings`;
}

function ResaleEditor({ item, onSetResale }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const custom = item.resaleSource === "listing" || item.resaleSource === "model";
  const model = modelKey(item);

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
            className="w-full rounded-lg bg-zinc-800 py-1.5 pl-7 pr-2 text-sm text-zinc-100 outline-none ring-1 ring-zinc-700 focus:ring-emerald-400"
            placeholder="Resale value"
          />
        </div>
        <button type="submit" className="rounded-lg bg-emerald-400 px-3 text-sm font-semibold text-emerald-950">
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
        <p className="text-[11px] text-zinc-500">Used for every {model} listing from now on.</p>
      )}
    </form>
  );
}
