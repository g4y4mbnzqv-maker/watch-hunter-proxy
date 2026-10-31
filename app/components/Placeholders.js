// Small presentational pieces used around the results

export function Stat({ label, value, note, accent = false }) {
  return (
    <div
      className={`rounded-2xl px-4 py-3.5 ring-1 backdrop-blur ${
        accent
          ? "bg-gradient-to-br from-emerald-400/15 to-teal-300/5 ring-emerald-400/25"
          : "bg-zinc-900/60 ring-white/5"
      }`}
    >
      <div className="text-[11px] font-medium uppercase tracking-widest text-zinc-400">{label}</div>
      <div
        className={`mt-1 text-3xl font-bold tracking-tight tabular-nums ${
          accent ? "text-emerald-300" : "text-zinc-50"
        }`}
      >
        {value}
      </div>
      {note && <div className="mt-0.5 text-[11px] text-zinc-500">{note}</div>}
    </div>
  );
}

export function Notice({ tone = "amber", children }) {
  const tones = {
    amber: "bg-amber-950/30 text-amber-200 ring-amber-500/30",
    rose: "bg-rose-950/40 text-rose-200 ring-rose-500/40",
  };
  return <div className={`mb-6 rounded-2xl p-4 text-sm ring-1 ${tones[tone]}`}>{children}</div>;
}

export function EmptyState({ title, body, action, onAction }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-zinc-900/30 px-6 py-12 text-center">
      <p className="text-sm text-zinc-300">{title}</p>
      {body && <p className="mt-1 text-xs text-zinc-500">{body}</p>}
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-xl px-4 py-2 text-sm text-zinc-200 ring-1 ring-zinc-700 hover:ring-zinc-500"
        >
          {action}
        </button>
      )}
    </div>
  );
}

export function Hero() {
  return (
    <div className="mb-6 mt-2 sm:mt-6">
      <h1 className="bg-gradient-to-br from-white via-white to-emerald-300 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-5xl">
        Find watches worth flipping
      </h1>
      <p className="mt-2 max-w-xl text-sm text-zinc-400 sm:text-base">
        UK auctions and Buy It Now listings priced below what they resell for, after fees and
        postage.
      </p>
    </div>
  );
}

const STEPS = [
  {
    title: "Scan a brand",
    body: "Pulls live UK auctions and Buy It Now listings, with parts, replicas and risky sellers filtered out.",
  },
  {
    title: "Estimate resale",
    body: "Compares current asking prices for the same model, matched by reference or by well-known names like Turtle or Black Bay.",
  },
  {
    title: "Bid to your limit",
    body: "Each card shows profit after fees and postage, and the most you can bid or offer to still hit your target.",
  },
];

export function Intro() {
  return (
    <section className="grid gap-4 sm:grid-cols-3">
      {STEPS.map((step, index) => (
        <div key={step.title} className="rounded-3xl bg-zinc-900/60 p-5 ring-1 ring-white/5 backdrop-blur">
          <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-300 text-sm font-bold text-emerald-950">
            {index + 1}
          </div>
          <h2 className="text-sm font-medium text-zinc-100">{step.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">{step.body}</p>
        </div>
      ))}
    </section>
  );
}

export function LoadingGrid() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="animate-pulse overflow-hidden rounded-3xl bg-zinc-900/60 ring-1 ring-white/5">
          <div className="aspect-[16/11] bg-zinc-800/80" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-4/5 rounded bg-zinc-800" />
            <div className="h-3 w-2/5 rounded bg-zinc-800" />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-14 rounded-xl bg-zinc-800" />
              <div className="h-14 rounded-xl bg-zinc-800" />
              <div className="h-14 rounded-xl bg-zinc-800" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
