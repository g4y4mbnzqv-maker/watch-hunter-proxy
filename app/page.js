"use client";

import { useState } from "react";

export default function Home() {
  const [brand, setBrand] = useState("seiko");
  const [includeJunk, setIncludeJunk] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function scan() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ brand });
      if (includeJunk) params.set("includeJunk", "1");

      const res = await fetch(`/api/scan?${params}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.message || `Scan failed (${res.status})`);
      }

      const enriched = data.results.map((item) => {
        const fairValue = estimateFairValue(item.currentBid);
        const edgePercent = calculateEdge(item.totalCost, fairValue);
        const maxBid = calculateMaxBid(fairValue, item.postage);
        const score = calculateScore(edgePercent, item.hoursLeft);

        return {
          ...item,
          fairValue,
          edgePercent,
          maxBid,
          score,
        };
      });

      enriched.sort((a, b) => b.score - a.score);

      setResults(enriched);
    } catch (err) {
      console.error(err);
      setError(err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  const isCritical = (r) => r.hoursLeft < 6 && r.edgePercent > 30;
  const critical = results.filter(isCritical);
  const normal = results.filter((r) => !isCritical(r));

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-5 max-w-2xl mx-auto">

      <h1 className="text-2xl font-semibold mb-4 tracking-tight">
        Watch Hunter
      </h1>

      <form
        className="flex gap-2 mb-3"
        onSubmit={(e) => {
          e.preventDefault();
          scan();
        }}
      >
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="bg-zinc-800 rounded px-3 py-2 flex-1"
          placeholder="Brand"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-emerald-500 disabled:opacity-60 text-black px-4 rounded font-semibold"
        >
          {loading ? "Scanning…" : "Scan"}
        </button>
      </form>

      <label className="flex items-center gap-2 text-sm text-zinc-400 mb-6">
        <input
          type="checkbox"
          checked={includeJunk}
          onChange={(e) => setIncludeJunk(e.target.checked)}
        />
        Include parts, repairs and accessories
      </label>

      {error && (
        <div className="rounded-lg border border-red-500 bg-red-950/30 text-red-300 text-sm p-3 mb-6">
          {error}
        </div>
      )}

      {critical.length > 0 && (
        <>
          <h2 className="text-sm text-red-400 mb-3 tracking-wide">
            ENDING SOON & HIGH MARGIN
          </h2>
          {critical.map((item) => (
            <AuctionCard key={item.itemId} item={item} critical />
          ))}
        </>
      )}

      {normal.length > 0 && (
        <>
          <h2 className="text-sm text-zinc-400 mt-6 mb-3 tracking-wide">
            All Opportunities
          </h2>
          {normal.map((item) => (
            <AuctionCard key={item.itemId} item={item} />
          ))}
        </>
      )}

      {results.length === 0 && !loading && !error && (
        <div className="text-zinc-500 text-sm mt-6">
          No results yet. Run a scan.
        </div>
      )}
    </div>
  );
}

/* ---------- Card Component ---------- */

function AuctionCard({ item, critical }) {
  return (
    <div
      className={`rounded-xl p-4 mb-4 border transition ${
        critical
          ? "border-red-500 bg-red-950/30"
          : "border-zinc-800 bg-zinc-900"
      }`}
    >
      {item.image && (
        <img
          src={item.image}
          alt={item.title}
          className="rounded-lg mb-3 w-full"
        />
      )}

      <div className="text-sm text-zinc-300 mb-3">{item.title}</div>

      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="text-2xl font-bold">
            {formatGbp(item.totalCost)}
          </div>
          <div className="text-xs text-zinc-400">
            {formatGbp(item.currentBid)} bid ·{" "}
            {item.postage === null
              ? "postage unknown"
              : item.postage === 0
              ? "free postage"
              : `${formatGbp(item.postage)} postage`}
          </div>
          <div className="text-xs text-zinc-400">
            {item.bidCount} {item.bidCount === 1 ? "bid" : "bids"}
          </div>
        </div>

        <div className="text-right">
          <div
            className={`text-2xl font-bold ${
              item.edgePercent > 40
                ? "text-emerald-400"
                : item.edgePercent > 20
                ? "text-emerald-300"
                : "text-zinc-400"
            }`}
          >
            -{item.edgePercent}%
          </div>

          <div
            className={`text-xs ${
              item.hoursLeft < 6
                ? "text-red-400"
                : item.hoursLeft < 24
                ? "text-amber-400"
                : "text-zinc-400"
            }`}
          >
            {formatTimeLeft(item.hoursLeft)}
          </div>
        </div>
      </div>

      <div className="text-xs text-zinc-400 mb-3">
        Fair {formatGbp(item.fairValue)} · Max bid {formatGbp(item.maxBid)}
      </div>

      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg py-2 transition"
      >
        View Auction
      </a>
    </div>
  );
}

/* ---------- Formatting ---------- */

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

function formatGbp(value) {
  return gbp.format(value);
}

function formatTimeLeft(hoursLeft) {
  const totalMinutes = Math.floor(hoursLeft * 60);
  if (totalMinutes <= 0) return "Ended";

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/* ---------- Logic ---------- */

function estimateFairValue(currentBid) {
  // TEMPORARY until sold price data is wired
  return Math.round(currentBid * 2.5);
}

function calculateEdge(totalCost, fair) {
  if (!fair || fair === 0) return 0;
  return Math.round(((fair - totalCost) / fair) * 100);
}

function calculateMaxBid(fair, postage) {
  // Spend no more than 65% of fair value including postage
  return Math.max(Math.round(fair * 0.65 - (postage ?? 0)), 0);
}

function calculateScore(edgePercent, hoursLeft) {
  const urgencyWeight =
    hoursLeft < 6 ? 30 :
    hoursLeft < 24 ? 15 :
    0;

  return edgePercent + urgencyWeight;
}
