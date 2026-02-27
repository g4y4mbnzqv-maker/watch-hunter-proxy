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
    setResults(data.results || []);
    setLoading(false);
  }

  return (
    <div
      style={{
        padding: 20,
        maxWidth: 500,
        margin: "auto",
        fontFamily: "system-ui",
      }}
    >
      <h1 style={{ marginBottom: 20 }}>Watch Hunter</h1>

      <select
        value={brand}
        onChange={(e) => setBrand(e.target.value)}
        style={{
          width: "100%",
          padding: 12,
          marginBottom: 15,
          background: "#1a1a1a",
          border: "none",
          color: "white",
        }}
      >
        <option value="seiko">Seiko</option>
        <option value="omega">Omega</option>
        <option value="heuer">Heuer</option>
        <option value="citizen">Citizen</option>
      </select>

      <button
        onClick={scan}
        style={{
          width: "100%",
          padding: 12,
          background: "#16a34a",
          border: "none",
          color: "white",
          marginBottom: 20,
          cursor: "pointer",
        }}
      >
        {loading ? "Scanning..." : "Scan"}
      </button>

      {results.length === 0 && !loading && (
        <div style={{ color: "#888" }}>
          No strong opportunities found.
        </div>
      )}

      {results.map((item, i) => (
        <div
          key={i}
          style={{
            background: "#1a1a1a",
            padding: 15,
            marginBottom: 20,
            borderRadius: 10,
          }}
        >
          {item.image && (
            <img
              src={item.image}
              alt=""
              style={{
                width: "100%",
                borderRadius: 8,
                marginBottom: 10,
              }}
            />
          )}

          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            {item.title}
          </div>

          <div>⏱ {item.daysLeft}d {item.hoursLeft}h left</div>
          <div>Current Bid: £{item.currentBid}</div>
          <div>Bidders: {item.bidderCount ?? "—"}</div>
          <div>Total Bids: {item.bidCount}</div>

          <div style={{ marginTop: 10 }}>
            <div>Baseline Sold: £{item.avgSold.toFixed(0)}</div>

            <div style={{ color: "#22c55e", fontWeight: 600 }}>
              Discount {(item.discount * 100).toFixed(1)}%
            </div>

            <div style={{ color: "#eab308" }}>
              Max Bid £{item.maxBid}
            </div>
          </div>

          <a
            href={item.url}
            target="_blank"
            style={{
              display: "block",
              textAlign: "center",
              background: "#333",
              padding: 10,
              borderRadius: 6,
              textDecoration: "none",
              color: "white",
              marginTop: 10,
            }}
          >
            View Listing
          </a>
        </div>
      ))}
    </div>
  );
}