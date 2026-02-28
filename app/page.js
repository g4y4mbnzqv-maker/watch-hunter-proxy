"use client";

import { useState } from "react";

export default function Home() {
  const [brand, setBrand] = useState("seiko");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  async function scan() {
    setLoading(true);
    const res = await fetch(`/api/scan?brand=${brand}`);
    const data = await res.json();

    const enriched = data.results.map((item) => {
      const fairValue = estimateFairValue(item.currentBid);
      const edgePercent = calculateEdge(item.currentBid, fairValue);
      const maxBid = calculateMaxBid(fairValue);
      const score = calculateScore(edgePercent, item.hoursLeft);

      return {
        ...item,
        fairValue,
        edgePercent,
        maxBid,
        score,
      };
    });

    // sort by score descending
    enriched.sort((a, b) => b.score - a.score);

    setResults(enriched);
    setLoading(false);
  }

  const critical = results.filter(
    (r) => r.hoursLeft < 6 && r.edgePercent > 30
  );

  const normal = results.filter(
    (r) => !(r.hoursLeft < 6 && r.edgePercent > 30)
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-5">

      <h1 className="text-2xl font-semibold mb-4 tracking-tight">
        Watch Hunter
      </h1>

      <div className="flex gap-2 mb-6">
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="bg-zinc-800 rounded px-3 py-2 flex-1"
          placeholder="Brand"
        />
        <button
          onClick={scan}
          className="bg-emerald-500 text-black px-4 rounded font-semibold"
        >
          {loading ? "Scanning…" : "Scan"}
        </button>
      </div>

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
      <img
        src={item.image}
        className="rounded-lg mb-3"
      />

      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="text-2xl font-bold">
            £{item.currentBid}
          </div>
          <div className="text-xs text-zinc-400">
            {item.bidCount} bids
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
            {item.daysLeft}d {item.hoursLeft}h
          </div>
        </div>
      </div>

      <div className="text-xs text-zinc-400 mb-3">
        Fair £{item.fairValue} · Max £{item.maxBid}
      </div>

      <a
        href={item.url}
        target="_blank"
        className="block text-center bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg py-2 transition"
      >
        View Auction
      </a>
    </div>
  );
}

/* ---------- Logic ---------- */

function estimateFairValue(currentBid) {
  // placeholder until sold data connected
  return Math.round(currentBid * 2.5);
}

function calculateEdge(current, fair) {
  if (!fair || fair === 0) return 0;
  return Math.round(((fair - current) / fair) * 100);
}

function calculateMaxBid(fair) {
  return Math.round(fair * 0.65);
}

function calculateScore(edgePercent, hoursLeft) {
  const urgencyWeight = hoursLeft < 6 ? 30 : hoursLeft < 24 ? 15 : 0;
  return edgePercent + urgencyWeight;
}