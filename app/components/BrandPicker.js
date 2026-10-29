"use client";

import { useState } from "react";
import { MORE_GROUPS, POPULAR } from "@/lib/brands";

export { POPULAR };

export default function BrandPicker({ selected, disabled, onPick }) {
  const [showAll, setShowAll] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {POPULAR.map((name) => (
          <BrandChip
            key={name}
            name={name}
            selected={selected}
            disabled={disabled}
            onPick={onPick}
          />
        ))}
        <button
          type="button"
          onClick={() => setShowAll((open) => !open)}
          aria-expanded={showAll}
          className="rounded-full px-3 py-1 text-xs font-medium text-emerald-300 hover:text-emerald-200"
        >
          {showAll ? "Fewer brands" : "All brands"}
        </button>
      </div>

      {showAll &&
        MORE_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">
              {group.label}
            </div>
            <div className="flex flex-wrap gap-2">
              {group.brands.map((name) => (
                <BrandChip
                  key={name}
                  name={name}
                  selected={selected}
                  disabled={disabled}
                  onPick={onPick}
                />
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

function BrandChip({ name, selected, disabled, onPick }) {
  const active = selected?.toLowerCase() === name.toLowerCase();

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(name)}
      className={`rounded-full px-3 py-1 text-xs ring-1 transition ${
        active
          ? "bg-white text-zinc-950 ring-white"
          : "text-zinc-300 ring-white/10 hover:bg-white/5 hover:ring-white/20"
      }`}
    >
      {name}
    </button>
  );
}
