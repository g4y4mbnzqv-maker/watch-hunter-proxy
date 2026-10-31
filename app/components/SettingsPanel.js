"use client";

import { DEFAULT_SETTINGS } from "@/lib/profit";
import { useSyncStatus } from "../client/sync";
import { useDealAlerts } from "../client/useDealAlerts";

const FIELDS = [
  {
    key: "minProfit",
    label: "Target profit",
    prefix: "£",
    help: "A listing counts as a deal once it clears this.",
  },
  {
    key: "maxBudget",
    label: "Maximum spend",
    prefix: "£",
    help: "Hides listings already costing more than this, including postage, and keeps \"Bid up to\" within it. 0 means no limit.",
  },
  {
    key: "resalePercent",
    label: "Expected sale price",
    suffix: "%",
    help: "Share of current Buy It Now asking prices you expect to get. Asking prices usually sit above what watches sell for.",
  },
  {
    key: "sellingFeePercent",
    label: "Selling fees",
    suffix: "%",
    help: "Your eBay final value fee. Check what your account pays.",
  },
  {
    key: "vintedFeePercent",
    label: "Vinted seller fee",
    suffix: "%",
    help: "For the Vinted profit on each card. UK sellers currently pay no fee, and the buyer pays postage.",
  },
  {
    key: "postageOut",
    label: "Postage to your buyer",
    prefix: "£",
    help: "Tracked and insured postage when you resell.",
  },
  {
    key: "extraCosts",
    label: "Extra costs per watch",
    prefix: "£",
    help: "Battery, service, cleaning or a new strap.",
  },
];

const SELLER_FIELDS = [
  {
    key: "sellerMinFeedback",
    label: "Minimum seller feedback",
    help: "Sellers with fewer feedback ratings get a caution flag. Under 10 is always risky.",
  },
  {
    key: "sellerMinPositive",
    label: "Minimum positive feedback",
    suffix: "%",
    help: "Sellers below this get a caution flag. Under 95% is always risky.",
  },
];

export default function SettingsPanel({ settings, onChange }) {
  return (
    <section className="rounded-3xl bg-zinc-900/60 p-5 ring-1 ring-white/5 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-100">Settings</h2>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_SETTINGS)}
          className="text-xs text-zinc-400 hover:text-zinc-200"
        >
          Reset to defaults
        </button>
      </div>

      <FieldGrid fields={FIELDS} settings={settings} onChange={onChange} />

      <h3 className="mb-4 mt-6 text-sm font-medium text-zinc-100">
        Seller checks
      </h3>
      <FieldGrid fields={SELLER_FIELDS} settings={settings} onChange={onChange} />

      <DealAlerts />

      <SyncLine />
    </section>
  );
}

const SYNC_TEXT = {
  checking: { dot: "bg-zinc-500", text: "Checking whether your data syncs…" },
  on: { dot: "bg-emerald-400", text: "Your watchlist, settings and sales log sync across your devices." },
  "no-passcode": {
    dot: "bg-amber-400",
    text: "Saved in this browser only. Set APP_PASSCODE in Vercel to sync across devices, so nobody else can see your data.",
  },
  "no-database": { dot: "bg-amber-400", text: "Saved in this browser only. Connect a database in Vercel to sync across devices." },
  offline: { dot: "bg-amber-400", text: "Couldn't reach the server, so changes are saved in this browser for now." },
};

const ALERT_TEXT = {
  checking: "Checking…",
  unsupported: "This browser can't receive alerts while the app is closed.",
  "install-first": "On iPhone, add Watch Hunter to your home screen first (Share, then Add to Home Screen), then open it from there.",
  unavailable: "Alerts need a database and APP_PASSCODE set in Vercel, like syncing.",
  blocked: "Notifications are blocked for this site. Allow them in your browser or phone settings, then come back.",
  off: "Get a notification when a new Buy It Now deal turns up in your Top deals brands, even with the app closed.",
  on: "On for this device. New Buy It Now deals in your Top deals brands are checked about once an hour, 7am to 11pm.",
};

function DealAlerts() {
  const { status, message, turnOn, turnOff, sendTest } = useDealAlerts();
  return (
    <div className="mt-6 border-t border-white/5 pt-4">
      <h3 className="text-sm font-medium text-zinc-100">Deal alerts</h3>
      <p className="mt-1 text-xs leading-relaxed text-zinc-400">{ALERT_TEXT[status]}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {status === "off" && (
          <button type="button" onClick={turnOn} className="rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200">
            Turn on alerts for this device
          </button>
        )}
        {status === "on" && (
          <>
            <button type="button" onClick={sendTest} className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-zinc-200 ring-1 ring-white/15 hover:bg-white/5">
              Send a test alert
            </button>
            <button type="button" onClick={turnOff} className="rounded-full px-3.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">
              Turn off
            </button>
          </>
        )}
      </div>
      {message && <p className="mt-2 text-xs text-amber-300">{message}</p>}
    </div>
  );
}

function SyncLine() {
  const status = useSyncStatus();
  const { dot, text } = SYNC_TEXT[status] ?? SYNC_TEXT.checking;
  return (
    <p className="mt-6 flex items-start gap-2 border-t border-white/5 pt-4 text-xs text-zinc-400">
      <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      {text}
    </p>
  );
}

function FieldGrid({ fields, settings, onChange }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((field) => (
        <label key={field.key} className="block">
          <span className="text-xs font-medium text-zinc-300">
            {field.label}
          </span>
          <div className="relative mt-1.5">
            {field.prefix && (
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                {field.prefix}
              </span>
            )}
            <input
              type="number"
              min="0"
              step="any"
              value={settings[field.key]}
              onChange={(e) =>
                onChange({
                  ...settings,
                  [field.key]: Math.max(parseFloat(e.target.value) || 0, 0),
                })
              }
              className={`w-full rounded-xl bg-black/30 py-2 text-sm text-zinc-100 outline-none ring-1 ring-white/10 focus:ring-emerald-400 ${
                field.prefix ? "pl-7 pr-3" : "pl-3 pr-8"
              }`}
            />
            {field.suffix && (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                {field.suffix}
              </span>
            )}
          </div>
          <span className="mt-1.5 block text-[11px] leading-snug text-zinc-500">
            {field.help}
          </span>
        </label>
      ))}
    </div>
  );
}
