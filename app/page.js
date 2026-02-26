"use client";
import { useState } from "react";

export default function Home() {
  const [brand, setBrand] = useState("seiko");
  const [results, setResults] = useState([]);

  async function scan() {
    const res = await fetch(`/api/scan?brand=${brand}`);
    const data = await res.json();
    setResults(data.results || []);
  }

  return (
    <div style={{ padding: 20, maxWidth: 500, margin: "auto" }}>
      <h1 style={{ marginBottom: 20 }}>Watch Hunter</h1>

      <select
        value={brand}
        onChange={e => setBrand(e.target.value)}
        style={{
          width: "100%",
          padding: 10,
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
        }}
      >
        Scan
      </button>

      {results.map((item, i) => (
        <div
          key={i}
          style={{
            background: "#1a1a1a",
            padding: 15,
            marginBottom: 15,
            borderRadius: 8,
          }}
        >
          <img
            src={item.image}
            style={{ width: "100%", marginBottom: 10 }}
          />

          <div style={{ fontWeight: 600 }}>
            {item.title}
          </div>

          <div>Live £{item.livePrice}</div>
          <div>Avg £{item.avgSold.toFixed(0)}</div>

          <div style={{ color: "#22c55e", marginTop: 5 }}>
            Discount {(item.discount * 100).toFixed(1)}%
          </div>

          <div style={{ color: "#eab308", marginBottom: 8 }}>
            Max Bid £{item.maxBid}
          </div>

          <a
            href={item.url}
            target="_blank"
            style={{
              display: "block",
              textAlign: "center",
              background: "#333",
              padding: 8,
              borderRadius: 5,
              textDecoration: "none",
              color: "white",
            }}
          >
            View
          </a>
        </div>
      ))}
    </div>
  );
}