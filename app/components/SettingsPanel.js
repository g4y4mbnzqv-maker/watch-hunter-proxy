"use client";

import { DEFAULT_SETTINGS } from "@/lib/profit";
import { niche } from "@/lib/niche";
import { isUkPostcode } from "@/lib/postcode";

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
    help: "Share of current Buy It Now asking prices you expect to get. Asking prices usually sit above what things really sell for.",
  },
  {
    key: "sellingFeePercent",
    label: "Selling fees",
    suffix: "%",
    help: "Your eBay final value fee. Check what your account pays.",
  },
  {
    key: "postageOut",
    label: "Postage to your buyer",
    prefix: "£",
    help: "Tracked and insured postage when you resell.",
  },
  {
    key: "extraCosts",
    label: `Extra costs per ${niche.noun.one}`,
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

      {niche.collection && <CollectionFields settings={settings} onChange={onChange} />}
    </section>
  );
}

const DISTANCES = [0, 10, 25, 50, 100];

// Where you'd collect from, for apps where most things are collection only
function CollectionFields({ settings, onChange }) {
  const postcode = settings.postcode ?? "";
  const valid = !postcode || isUkPostcode(postcode);
  return (
    <>
      <h3 className="mb-4 mt-6 text-sm font-medium text-zinc-100">Collection</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium text-zinc-300">Your postcode</span>
          <input
            type="text"
            autoComplete="postal-code"
            value={postcode}
            onChange={(e) => onChange({ ...settings, postcode: e.target.value.toUpperCase() })}
            placeholder="CB1 2AB"
            className="mt-1.5 w-full rounded-xl bg-black/30 px-3 py-2 text-sm uppercase text-zinc-100 outline-none ring-1 ring-white/10 focus:ring-emerald-400"
          />
          <span className={`mt-1.5 block text-[11px] leading-snug ${valid ? "text-zinc-500" : "text-rose-300"}`}>
            {valid ? "Your full postcode. Only sent to eBay, to find bikes near you." : "That doesn't look like a full UK postcode."}
          </span>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-zinc-300">How far you'd travel</span>
          <select
            value={settings.collectionMiles ?? 0}
            onChange={(e) => onChange({ ...settings, collectionMiles: Number(e.target.value) })}
            className="mt-1.5 w-full rounded-xl bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none ring-1 ring-white/10 focus:ring-emerald-400"
          >
            {DISTANCES.map((miles) => (
              <option key={miles} value={miles}>
                {miles ? `Collection within ${miles} miles` : "Anywhere in the UK"}
              </option>
            ))}
          </select>
          <span className="mt-1.5 block text-[11px] leading-snug text-zinc-500">
            With a distance set, scans only show bikes offering collection that close to you.
          </span>
        </label>
      </div>
    </>
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
