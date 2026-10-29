"use client";

import UsageMeter from "./UsageMeter";
import { niche } from "@/lib/niche";

const TABS = [
  { key: "scan", label: "Find deals" },
  { key: "watchlist", label: "Watchlist" },
  { key: "index", label: "Prices" },
  { key: "deals", label: "Sales" },
];

export default function AppHeader({ mode, onModeChange, watchCount, usage, showSettings, onToggleSettings }) {
  return (
    // The shadow paints the bar's background out to both screen edges
    // without the page needing to scroll sideways
    <header className="sticky top-0 z-30 mb-6 bg-zinc-950/80 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-[0_0_0_100vmax_rgba(9,9,11,0.8),0_1px_0_100vmax_rgba(255,255,255,0.05)] backdrop-blur-xl [clip-path:inset(0_-100vmax)]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-2.5">
          <img src="/icons/icon-192.png" alt="" className="h-8 w-8 rounded-xl ring-1 ring-white/10" />
          <span className="text-lg font-semibold tracking-tight text-white">{niche.appName}</span>
        </div>

        <nav className="order-last flex w-full rounded-full bg-white/5 p-1 ring-1 ring-white/10 sm:order-none sm:ml-4 sm:w-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => onModeChange(tab.key)}
              className={`flex-1 whitespace-nowrap rounded-full px-2 py-1.5 text-sm font-medium transition sm:flex-none sm:px-4 ${
                mode === tab.key ? "bg-white text-zinc-950 shadow" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {tab.label}
              {tab.key === "watchlist" && (
                <span className="ml-1.5 tabular-nums opacity-60">{watchCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden sm:block">
            <UsageMeter usage={usage} />
          </div>
          <button
            type="button"
            onClick={onToggleSettings}
            aria-pressed={showSettings}
            aria-label="Settings"
            title="Settings"
            className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 transition ${
              showSettings ? "bg-white text-zinc-950 ring-white" : "text-zinc-300 ring-white/15 hover:bg-white/5"
            }`}
          >
            <SettingsIcon />
          </button>
        </div>
      </div>
      <div className="mt-3 sm:hidden">
        <UsageMeter usage={usage} />
      </div>
    </header>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" strokeLinecap="round" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  );
}
