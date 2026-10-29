"use client";

import { useState } from "react";
import BrandPicker from "./BrandPicker";
import ConditionFilter from "./ConditionFilter";
import ListingTypeFilter from "./ListingTypeFilter";
import { niche } from "@/lib/niche";

const GOOD_OR_BETTER = ["new", "excellent", "good"];

// The search box keeps its own text, so typing only redraws this panel
export default function SearchPanel({
  scannedBrand,
  loading,
  paused,
  topProgress,
  onScan,
  onTopDeals,
  topBrands,
  onTopBrandsChange,
  includeJunk,
  onIncludeJunkChange,
  hideRisky,
  onHideRiskyChange,
  guaranteedOnly,
  onGuaranteedOnlyChange,
  listingTypes,
  onListingTypesChange,
  grades,
  onGradesChange,
}) {
  const [brand, setBrand] = useState(niche.popular[0]);
  const busy = loading || paused;

  function scan(searchBrand) {
    const query = searchBrand.trim();
    if (!query) return;
    setBrand(query);
    onScan(query);
  }

  return (
    <section className="mb-6 rounded-3xl bg-zinc-900/60 p-4 ring-1 ring-white/5 backdrop-blur sm:p-5">
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          scan(brand);
        }}
      >
        <div className="relative flex-1">
          <SearchIcon />
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-full rounded-2xl bg-black/30 py-3.5 pl-11 pr-4 text-zinc-50 outline-none ring-1 ring-white/10 transition placeholder:text-zinc-500 focus:ring-2 focus:ring-emerald-400/70"
            placeholder={niche.searchPlaceholder}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-300 px-6 py-3.5 font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:opacity-60"
        >
          {loading && !topProgress ? "Scanning…" : "Find deals"}
        </button>
        <button
          type="button"
          onClick={onTopDeals}
          disabled={busy}
          title={`Scan ${topBrands.join(", ")} and show the best deals across all of them`}
          className="rounded-2xl px-5 py-3.5 font-semibold text-emerald-300 ring-1 ring-emerald-400/40 transition hover:bg-emerald-400/10 disabled:opacity-60"
        >
          {topProgress ? `Scanning ${topProgress.done}/${topProgress.total}…` : "Top deals"}
        </button>
      </form>

      <div className="mt-4">
        <BrandPicker
          selected={scannedBrand}
          disabled={busy}
          onPick={scan}
          topBrands={topBrands}
          onTopBrandsChange={onTopBrandsChange}
          onTopDeals={onTopDeals}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/5 pt-4">
        <span className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {niche.noun.many[0].toUpperCase() + niche.noun.many.slice(1)} located in the UK
        </span>
        <Checkbox checked={includeJunk} onChange={onIncludeJunkChange}>
          Include parts and repairs
        </Checkbox>
        <Checkbox checked={hideRisky} onChange={onHideRiskyChange}>
          Hide risky sellers
        </Checkbox>
        <Checkbox checked={guaranteedOnly} onChange={onGuaranteedOnlyChange}>
          Authenticity Guarantee only
        </Checkbox>
      </div>

      <div className="mt-3">
        <ListingTypeFilter selected={listingTypes} onChange={onListingTypesChange} />
      </div>

      <ConditionFilter selected={grades} onChange={onGradesChange} goodOrBetter={GOOD_OR_BETTER} />
    </section>
  );
}

function Checkbox({ checked, onChange, children }) {
  return (
    <label className="flex items-center gap-2 text-xs text-zinc-400">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-emerald-500"
      />
      {children}
    </label>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}
