"use client";

// Shown once eBay refuses calls because the app's allowance is used up
export default function LimitBanner({ resetAt, onRetry }) {
  const resetTime = resetAt
    ? new Date(resetAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <section
      role="status"
      className="mb-6 flex flex-wrap items-center gap-3 rounded-3xl bg-gradient-to-br from-amber-400/15 to-amber-400/5 p-4 ring-1 ring-amber-300/30 backdrop-blur"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-amber-100">
          You've used today's eBay allowance.
        </p>
        <p className="mt-0.5 text-xs text-amber-200/80">
          {resetTime
            ? `Scans and refreshes are paused until it resets at ${resetTime}. Saved auctions still show their last bids.`
            : "Scans and refreshes are paused until eBay resets it. Saved auctions still show their last bids."}
        </p>
      </div>
      {!resetTime && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full px-3.5 py-2 text-sm font-medium text-amber-100 ring-1 ring-amber-300/40 hover:bg-amber-300/10"
        >
          Try again
        </button>
      )}
    </section>
  );
}
