"use client";

import { useState } from "react";

const POPULAR = ["Seiko", "Citizen", "Orient", "Casio", "Swatch", "Tissot", "Hamilton", "Omega", "Rolex"];

const MORE_GROUPS = [
  {
    label: "Everyday and vintage",
    brands: ["Timex", "Bulova", "Accurist", "Rotary", "Sekonda", "Smiths", "Lorus", "Pulsar", "Fossil"],
  },
  {
    label: "Mid-range",
    brands: [
      "Longines", "TAG Heuer", "Oris", "Certina", "Mido", "Rado", "Raymond Weil",
      "Junghans", "Sinn", "Baume & Mercier", "Frederique Constant",
    ],
  },
  {
    label: "Microbrands",
    brands: ["Studio Underdog", "Christopher Ward"],
  },
  {
    label: "Luxury",
    brands: ["Tudor", "Breitling", "Grand Seiko", "Cartier", "IWC", "Zenith", "Jaeger-LeCoultre", "Panerai"],
  },
];

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
          className="rounded-full px-3 py-1 text-xs text-emerald-400 hover:text-emerald-300"
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
          ? "bg-zinc-100 text-zinc-950 ring-zinc-100"
          : "text-zinc-300 ring-zinc-700 hover:ring-zinc-500"
      }`}
    >
      {name}
    </button>
  );
}
