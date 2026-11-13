"use client";

import { useEffect, useState } from "react";
import { formatGbp } from "./format";
import { readJson } from "../client/readJson";
import { CONDITIONS, DEPARTMENTS, MAX_PHOTOS, listingProblem } from "@/lib/ebayListing";
import { extractModelRef } from "@/lib/models";
import { extractModelName } from "@/lib/nicknames";

const INPUT = "w-full rounded-lg bg-black/30 px-2.5 py-1.5 text-xs text-sky-50 outline-none ring-1 ring-sky-300/20 focus:ring-sky-300/60";
const BUTTON = "rounded-full bg-sky-300 px-3.5 py-1.5 text-xs font-semibold text-sky-950 hover:bg-sky-200 disabled:opacity-40";
const today = () => new Date().toISOString().slice(0, 10);

async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    ...(body instanceof FormData ? { body } : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) }),
  });
  const data = await readJson(res);
  if (!res.ok || data.error) throw new Error(data.message || `eBay request failed (${res.status})`);
  return data;
}

// Lists a watch from your sales log on eBay: your photos, the drafted title
// and description, and the suggested price, after you've checked them.
// Saved first without going live, then put live with a second tap.
export default function EbayLister({ deal, title: draftTitle, text, prices, onChange }) {
  const [status, setStatus] = useState({ loading: true });
  const [form, setForm] = useState(() => {
    const reference = extractModelRef(deal.title) ?? "";
    const name = extractModelName(deal.title);
    return {
      title: draftTitle,
      description: text,
      brand: deal.brand ?? "",
      model: name ? name.replace(new RegExp(`^${deal.brand} `, "i"), "") : "",
      reference,
      department: "Men",
      condition: "PRE_OWNED_EXCELLENT",
      price: prices?.ebay ?? "",
      bestOffer: true,
      minOffer: prices?.lowestOffer ?? "",
    };
  });
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(0);
  const [postcode, setPostcode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [offerId, setOfferId] = useState(null);
  const set = (changes) => setForm((current) => ({ ...current, ...changes }));

  async function loadStatus() {
    try {
      const res = await fetch("/api/ebay/status");
      setStatus(await readJson(res));
    } catch (err) {
      setStatus({ error: err.message });
    }
  }
  useEffect(() => {
    loadStatus();
  }, []);

  async function addPhotos(files) {
    setError(null);
    for (const file of [...files].slice(0, MAX_PHOTOS - photos.length)) {
      setUploading((n) => n + 1);
      try {
        const body = new FormData();
        body.append("photo", file);
        const { url } = await post("/api/ebay/photo", body);
        setPhotos((current) => [...current, { url, name: file.name }]);
      } catch (err) {
        setError(err.message);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (status.loading) return <p className="text-sky-200/70">Checking your eBay account…</p>;
  if (status.unavailable === "no-runame" || status.unavailable === "no-keys") {
    return (
      <p className="text-sky-200/80">
        Listing straight to eBay needs one more setting: <code>EBAY_RUNAME</code> in Vercel, from your eBay developer account. The
        README's "Listing on eBay" section has the steps.
      </p>
    );
  }
  if (status.unavailable === "no-database") return <p className="text-sky-200/80">Listing on eBay needs the database connected.</p>;
  if (status.unavailable === "no-passcode") {
    return <p className="text-sky-200/80">Listing on eBay needs the app locked with APP_PASSCODE in Vercel, so only you can list.</p>;
  }
  if (!status.connected) {
    return (
      <div className="space-y-2">
        <p className="text-sky-200/80">Connect your eBay account once and the app can list your watches for you.</p>
        <a href="/api/ebay/connect" className={`${BUTTON} inline-block`}>
          Connect eBay account
        </a>
      </div>
    );
  }
  const { fulfillment, payment, returns } = status.policies ?? {};
  if (!fulfillment || !payment || !returns) {
    return (
      <p className="text-sky-200/80">
        Your eBay account needs a postage, a payment and a returns policy before the app can list for you. On eBay, go to Account,
        then Business policies, set them up, then{" "}
        <button type="button" onClick={loadStatus} className="underline">
          check again
        </button>
        .
      </p>
    );
  }
  if (!status.location) {
    return (
      <div className="space-y-2">
        <p className="text-sky-200/80">Where you post from, shown to buyers as the item location. Only the postcode is used.</p>
        <div className="flex gap-2">
          <input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="Postcode" className={INPUT} aria-label="Postcode" />
          <button
            type="button"
            disabled={busy || !postcode.trim()}
            onClick={() => run(async () => {
              await post("/api/ebay/location", { postcode });
              await loadStatus();
            })}
            className={BUTTON}
          >
            Save
          </button>
        </div>
        {error && <p className="text-rose-300">{error}</p>}
      </div>
    );
  }

  if (deal.ebayListingUrl) {
    return (
      <p className="text-sky-100">
        Live on eBay at {formatGbp(Number(deal.listedAt))}.{" "}
        <a href={deal.ebayListingUrl} target="_blank" rel="noopener noreferrer" className="underline">
          Open the listing ↗
        </a>
      </p>
    );
  }

  const input = { ...form, dealId: deal.id, photos: photos.map((photo) => photo.url) };
  const problem = listingProblem(input);

  return (
    <div className="space-y-2.5">
      <p className="text-sky-200/80">
        Using your policies: {fulfillment.name} (postage), {payment.name} (payment), {returns.name} (returns).
      </p>

      <label className="block">
        <span className="mb-1 block text-sky-200/80">Your photos ({photos.length}/{MAX_PHOTOS})</span>
        <input type="file" accept="image/*" multiple onChange={(e) => addPhotos(e.target.files)} className="text-xs text-sky-100" />
      </label>
      {uploading > 0 && <p className="text-sky-200/70">Uploading {uploading}…</p>}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {photos.map((photo, index) => (
            <button
              key={photo.url}
              type="button"
              onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}
              title="Remove"
              className="relative h-14 w-14 overflow-hidden rounded-lg ring-1 ring-sky-300/30"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-sky-200/80">Title ({form.title.length}/80)</span>
        <input value={form.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} className={INPUT} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sky-200/80">Description</span>
        <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={8} className={INPUT} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-sky-200/80">Brand</span>
          <input value={form.brand} onChange={(e) => set({ brand: e.target.value })} className={INPUT} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sky-200/80">Model</span>
          <input value={form.model} onChange={(e) => set({ model: e.target.value })} className={INPUT} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sky-200/80">Reference</span>
          <input value={form.reference} onChange={(e) => set({ reference: e.target.value })} className={INPUT} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sky-200/80">For</span>
          <select value={form.department} onChange={(e) => set({ department: e.target.value })} className={INPUT}>
            {DEPARTMENTS.map((department) => (
              <option key={department}>{department}</option>
            ))}
          </select>
        </label>
        <label className="col-span-2 block">
          <span className="mb-1 block text-sky-200/80">Condition</span>
          <select value={form.condition} onChange={(e) => set({ condition: e.target.value })} className={INPUT}>
            {CONDITIONS.map((condition) => (
              <option key={condition.key} value={condition.key}>
                {condition.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sky-200/80">Price (£)</span>
          <input type="number" inputMode="decimal" value={form.price} onChange={(e) => set({ price: e.target.value })} className={INPUT} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sky-200/80">Decline offers under (£)</span>
          <input
            type="number"
            inputMode="decimal"
            value={form.minOffer}
            disabled={!form.bestOffer}
            onChange={(e) => set({ minOffer: e.target.value })}
            className={INPUT}
          />
        </label>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.bestOffer} onChange={(e) => set({ bestOffer: e.target.checked })} />
        <span>Accept offers</span>
      </label>

      {!offerId ? (
        <button
          type="button"
          disabled={busy || uploading > 0 || Boolean(problem)}
          onClick={() => run(async () => setOfferId((await post("/api/ebay/list", input)).offerId))}
          className={BUTTON}
        >
          {busy ? "Saving…" : "Save on eBay (not live yet)"}
        </button>
      ) : (
        <div className="space-y-1.5">
          <p className="text-sky-100">Saved on eBay. Nothing is live until you put it live.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(async () => {
              const { url, listingId } = await post("/api/ebay/publish", { offerId });
              onChange({ listedOn: today(), listedAt: Number(form.price), ebayListingId: listingId, ebayListingUrl: url });
            })}
            className={BUTTON}
          >
            {busy ? "Putting it live…" : `Put it live at ${formatGbp(Number(form.price))}`}
          </button>
        </div>
      )}
      {problem && !offerId && <p className="text-sky-200/70">{problem}.</p>}
      {error && <p className="text-rose-300">{error}</p>}
    </div>
  );
}
