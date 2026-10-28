"use client";

export const LISTING_TYPES = [
  { key: "AUCTION", label: "Auctions" },
  { key: "BUY_IT_NOW", label: "Buy It Now" },
];

export default function ListingTypeFilter({ selected, onChange }) {
  function toggle(type) {
    const next = selected.includes(type)
      ? selected.filter((key) => key !== type)
      : [...selected, type];
    // Searching for nothing is never useful
    if (next.length) onChange(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-zinc-500">Show:</span>
      {LISTING_TYPES.map((option) => {
        const active = selected.includes(option.key);
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(option.key)}
            className={`rounded-full px-3 py-1 text-xs ring-1 transition ${
              active
                ? "bg-emerald-400/15 text-emerald-300 ring-emerald-400/40"
                : "text-zinc-500 ring-white/10 hover:text-zinc-300 hover:ring-white/20"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
