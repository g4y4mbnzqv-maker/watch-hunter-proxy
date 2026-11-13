"use client";

import { useState } from "react";
import { formatGbp } from "./format";
import { readJson } from "../client/readJson";
import { fetchPrices } from "../client/priceCheck";
import { photoGuide } from "@/lib/photoGuide";

// Longest side of the photo sent for matching; plenty for eBay's image search
const MAX_SIDE = 1000;

// Shrinks a phone photo to a small JPEG before upload, so it's quick on
// mobile data. Falls back to the original if the browser can't.
async function shrink(file) {
  try {
    const url = URL.createObjectURL(file);
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

const BUTTON = "rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-40";
const QUIET = "rounded-full px-3.5 py-2 text-sm text-zinc-300 ring-1 ring-white/10 hover:bg-white/5";

// Photo wizard: take a photo, tick the listings that are the same watch,
// and get a price guide with the most to pay
export default function PhotoPricer({ settings }) {
  const [step, setStep] = useState("photo");
  const [preview, setPreview] = useState(null);
  const [matches, setMatches] = useState([]);
  const [ticked, setTicked] = useState(() => new Set());
  const [name, setName] = useState("");
  const [byName, setByName] = useState(null);
  const [error, setError] = useState(null);

  // Frees the browser's copy of a photo once it's no longer shown
  function dropPreview() {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }

  function restart() {
    setStep("photo");
    dropPreview();
    setMatches([]);
    setTicked(new Set());
    setName("");
    setByName(null);
    setError(null);
  }

  async function search(file) {
    if (!file) return;
    setError(null);
    setStep("searching");
    try {
      const small = await shrink(file);
      dropPreview();
      setPreview(URL.createObjectURL(small));
      const body = new FormData();
      body.append("photo", small, "watch.jpg");
      const res = await fetch("/api/similar/upload", { method: "POST", body });
      const data = await readJson(res);
      if (!res.ok || data.error) throw new Error(data.message || `Photo search failed (${res.status})`);
      setMatches(data.items);
      setStep("pick");
    } catch (err) {
      setError(err.message);
      setStep("photo");
    }
  }

  async function price() {
    setStep("guide");
    setByName(null);
    if (!name.trim()) return;
    setByName({ loading: true });
    try {
      const [stats] = await fetchPrices([name.trim()]);
      setByName(stats ? { stats } : { none: true });
    } catch (err) {
      setByName({ error: err.message });
    }
  }

  const toggle = (id) =>
    setTicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const chosen = matches.filter((match) => ticked.has(match.itemId));
  const guide = photoGuide(chosen.map((match) => match.totalCost), settings);
  const nameGuide = byName?.stats ? photoGuide([byName.stats.median], settings) : null;

  return (
    <details className="mb-6 rounded-2xl bg-zinc-900/60 ring-1 ring-white/5 [&_summary::-webkit-details-marker]:hidden">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-zinc-200">
        Price a watch from a photo
        <span className="ml-2 text-xs font-normal text-zinc-500">car boot, shop, friend's drawer…</span>
      </summary>
      <div className="space-y-3 px-4 pb-4 text-sm">
        <ol className="flex gap-3 text-xs text-zinc-500" aria-label="Steps">
          {[
            ["photo", "1. Photo"],
            ["pick", "2. Pick matches"],
            ["guide", "3. Price guide"],
          ].map(([key, label]) => (
            <li key={key} className={step === key || (key === "photo" && step === "searching") ? "font-semibold text-zinc-200" : ""}>
              {label}
            </li>
          ))}
        </ol>

        {(step === "photo" || step === "searching") && (
          <>
            <p className="text-xs text-zinc-400">
              Photograph the dial straight on, filling the frame, in good light. The app finds similar watches for sale on eBay
              UK.
            </p>
            <label className={`${BUTTON} inline-block cursor-pointer ${step === "searching" ? "pointer-events-none opacity-40" : ""}`}>
              {step === "searching" ? "Looking for matches…" : "Take or choose a photo"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => search(e.target.files?.[0])}
              />
            </label>
            {error && <p className="text-xs text-rose-300">{error}</p>}
          </>
        )}

        {step === "pick" && (
          <>
            <div className="flex items-center gap-3">
              {preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Your photo" className="h-16 w-16 rounded-lg object-cover ring-1 ring-white/10" />
              )}
              <p className="text-xs text-zinc-400">
                Tick the listings that are the same watch: same brand, model, dial and case. Look-alikes that aren't will skew the
                price.
              </p>
            </div>
            {matches.length ? (
              <ul className="grid grid-cols-2 gap-2">
                {matches.map((match) => (
                  <li key={match.itemId}>
                    <label
                      className={`flex h-full cursor-pointer flex-col overflow-hidden rounded-xl ring-1 ${
                        ticked.has(match.itemId) ? "ring-emerald-400/70" : "ring-white/10"
                      }`}
                    >
                      <span className="relative block aspect-square bg-zinc-800">
                        {match.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={match.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                        )}
                        <input
                          type="checkbox"
                          checked={ticked.has(match.itemId)}
                          onChange={() => toggle(match.itemId)}
                          className="absolute left-2 top-2 h-5 w-5"
                          aria-label={`Same watch: ${match.title}`}
                        />
                      </span>
                      <span className="block p-2 text-[11px] leading-snug">
                        <span className="line-clamp-2 text-zinc-300">{match.title}</span>
                        <span className="mt-1 block font-semibold tabular-nums text-zinc-100">{formatGbp(match.totalCost)}</span>
                        <a
                          href={match.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-sky-300"
                        >
                          View ↗
                        </a>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-zinc-400">No similar UK listings found. Try a sharper photo of the dial, or type the model below.</p>
            )}
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-400">Know the brand and model? (optional, checks prices by name too)</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seiko SKX007"
                className="w-full rounded-xl bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none ring-1 ring-white/10 focus:ring-emerald-400/50"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={price} disabled={!chosen.length && !name.trim()} className={BUTTON}>
                {chosen.length ? `Price from ${chosen.length} ${chosen.length === 1 ? "match" : "matches"}` : "Price by name"}
              </button>
              <button type="button" onClick={restart} className={QUIET}>
                New photo
              </button>
            </div>
          </>
        )}

        {step === "guide" && (
          <>
            {guide ? (
              <div className="rounded-xl bg-black/30 p-3 ring-1 ring-white/10" role="status">
                <p className="text-xs uppercase tracking-widest text-zinc-500">From {guide.count} matching listings</p>
                <p className="mt-1 text-zinc-100">
                  Asking {formatGbp(guide.low)} to {formatGbp(guide.high)}, middle{" "}
                  <strong className="tabular-nums">{formatGbp(guide.median)}</strong>
                </p>
                <PriceLines guide={guide} settings={settings} />
                {guide.roughReason && <p className="mt-1 text-xs text-amber-200">Rough guide: {guide.roughReason}.</p>}
              </div>
            ) : (
              <p className="text-xs text-zinc-400">No matches ticked, so this uses the name only.</p>
            )}

            {byName?.loading && <p className="text-xs text-zinc-400">Checking listings for "{name}"…</p>}
            {byName?.stats && (
              <div className="rounded-xl bg-black/30 p-3 ring-1 ring-white/10">
                <p className="text-xs uppercase tracking-widest text-zinc-500">By name: {name}</p>
                <p className="mt-1 text-zinc-100">
                  Asking {formatGbp(byName.stats.low)} to {formatGbp(byName.stats.high)} across {byName.stats.count} pre-owned
                  listings, middle <strong className="tabular-nums">{formatGbp(byName.stats.median)}</strong>
                </p>
                {nameGuide && <PriceLines guide={nameGuide} settings={settings} />}
              </div>
            )}
            {byName?.none && (
              <p className="text-xs text-zinc-400">
                Too few listings named "{name}" to price it. Adding the reference number from the caseback usually helps.
              </p>
            )}
            {byName?.error && <p className="text-xs text-rose-300">{byName.error}</p>}

            <p className="text-xs text-zinc-500">
              Asking prices are higher than what watches sell for, so the likely sale uses your expected sale price. Check the
              watch runs, and look at the caseback and movement before paying.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setStep("pick")} className={QUIET}>
                Change matches
              </button>
              <button type="button" onClick={restart} className={QUIET}>
                Price another watch
              </button>
            </div>
          </>
        )}
      </div>
    </details>
  );
}

function PriceLines({ guide, settings }) {
  return (
    <>
      <p className="mt-1 text-zinc-300">
        Likely to sell for about <strong className="tabular-nums text-zinc-100">{formatGbp(guide.resale)}</strong>
        <span className="text-zinc-500"> ({settings.resalePercent}% of asking)</span>
      </p>
      <p className="mt-1 text-emerald-300">
        Pay no more than <strong className="tabular-nums">{formatGbp(guide.maxPay)}</strong> to make your{" "}
        {formatGbp(settings.minProfit)} target after fees and postage
      </p>
    </>
  );
}
