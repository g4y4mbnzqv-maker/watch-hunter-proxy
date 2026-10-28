"use client";

// Share of the daily allowance used before the meter turns amber, then red
const WARN_AT = 0.8;
const DANGER_AT = 0.95;

export default function UsageMeter({ usage }) {
  if (!usage) return null;

  const share = usage.limit > 0 ? usage.used / usage.limit : 0;
  const tone =
    share >= DANGER_AT
      ? { bar: "bg-rose-500", text: "text-rose-300" }
      : share >= WARN_AT
      ? { bar: "bg-amber-400", text: "text-amber-300" }
      : { bar: "bg-emerald-500", text: "text-zinc-400" };

  const resetTime = usage.reset
    ? new Date(usage.reset).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div
      className="w-44"
      title={`${usage.remaining.toLocaleString("en-GB")} eBay calls left${
        resetTime ? `, resets at ${resetTime}` : ""
      }`}
    >
      <div className={`mb-1 flex justify-between text-[11px] ${tone.text}`}>
        <span>eBay calls</span>
        <span className="tabular-nums">
          {usage.used.toLocaleString("en-GB")} / {usage.limit.toLocaleString("en-GB")}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full ${tone.bar}`}
          style={{ width: `${Math.min(share * 100, 100)}%` }}
        />
      </div>
      {share >= WARN_AT && (
        <div className={`mt-1 text-[11px] ${tone.text}`}>
          {share >= DANGER_AT ? "Nearly out" : "Running low"}
          {resetTime ? `, resets ${resetTime}` : ""}
        </div>
      )}
    </div>
  );
}
