"use client";

import { GRADES } from "@/lib/condition";

export default function ConditionFilter({ selected, onChange, goodOrBetter }) {
  const isGoodOrBetter =
    selected.length === goodOrBetter.length &&
    goodOrBetter.every((grade) => selected.includes(grade));

  function toggle(grade) {
    const next = selected.includes(grade)
      ? selected.filter((key) => key !== grade)
      : [...selected, grade];
    // Showing nothing at all is never useful
    if (next.length) onChange(next);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs text-zinc-500">Condition:</span>
      {GRADES.map((option) => {
        const active = selected.includes(option.key);
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(option.key)}
            className={`rounded-full px-3 py-1 text-xs ring-1 transition ${
              active
                ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/50"
                : "text-zinc-500 ring-zinc-800 hover:text-zinc-300 hover:ring-zinc-600"
            }`}
          >
            {option.label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => onChange(isGoodOrBetter ? GRADES.map((option) => option.key) : goodOrBetter)}
        className="rounded-full px-2 py-1 text-xs text-emerald-400 hover:text-emerald-300"
      >
        {isGoodOrBetter ? "Show all conditions" : "Good or better only"}
      </button>
    </div>
  );
}
