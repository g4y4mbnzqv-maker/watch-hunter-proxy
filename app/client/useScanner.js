"use client";

import { useState } from "react";
import { runPool } from "./listings";

// Label used in place of a brand once a Top deals scan has run
export const TOP_DEALS = "Top deals";
// Brands scanned at once by Top deals, to stay gentle on the eBay API
const TOP_DEALS_CONCURRENCY = 3;

// Brand scans and Top deals: the listings found and the state around them
export function useScanner({ listingTypes, includeJunk, onLimitHit, onScanned }) {
  const [results, setResults] = useState([]);
  const [scannedBrand, setScannedBrand] = useState(null);
  // What eBay returned for the last single-brand scan, to explain empty ones
  const [scanStats, setScanStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [topProgress, setTopProgress] = useState(null);
  const [topFailures, setTopFailures] = useState([]);

  async function fetchBrand(query) {
    const params = new URLSearchParams({ brand: query, types: listingTypes.join(",") });
    if (includeJunk) params.set("includeJunk", "1");

    const res = await fetch(`/api/scan?${params}`);
    const data = await res.json();

    if (data.limitReached) onLimitHit();

    if (!res.ok || data.error) {
      throw Object.assign(new Error(data.message || `Scan failed (${res.status})`), {
        limitReached: Boolean(data.limitReached),
      });
    }

    return data;
  }

  async function scan(query) {
    setLoading(true);
    setError(null);
    setTopFailures([]);

    try {
      const data = await fetchBrand(query);
      setResults(data.results);
      setScanStats(data.stats ?? null);
      setScannedBrand(query);
      onScanned({ topDeals: false });
    } catch (err) {
      console.error(err);
      // The limit banner explains a refused scan
      setError(err.limitReached ? null : err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  // Scans every brand given and combines the results
  async function scanTopDeals(brands) {
    setLoading(true);
    setError(null);
    setTopFailures([]);
    setTopProgress({ done: 0, total: brands.length });

    const found = {};
    const failures = [];
    let done = 0;
    let limited = false;

    // Starts the next brand as soon as one finishes
    await runPool(brands, TOP_DEALS_CONCURRENCY, async (name) => {
      try {
        // Once eBay refuses calls, the remaining brands would only fail too
        if (limited) throw Object.assign(new Error("Not scanned"), { skipped: true });
        found[name] = (await fetchBrand(name)).results;
      } catch (err) {
        if (!err.skipped) console.error(err);
        if (err.limitReached) limited = true;
        failures.push({ name, message: err.message });
      } finally {
        done += 1;
        setTopProgress({ done, total: brands.length });
      }
    });

    if (failures.length === brands.length) {
      setError(limited ? null : failures[0].message);
      setResults([]);
    } else {
      // In brand order, so a listing that matches two brands, such as Seiko
      // and Grand Seiko, keeps the first
      const combined = new Map();
      for (const name of brands) {
        for (const item of found[name] || []) {
          if (!combined.has(item.itemId)) combined.set(item.itemId, { ...item, brand: name });
        }
      }
      setResults([...combined.values()]);
      setScannedBrand(TOP_DEALS);
      setScanStats(null);
      setTopFailures(brands.filter((name) => failures.some((failure) => failure.name === name)));
      onScanned({ topDeals: true });
    }

    setTopProgress(null);
    setLoading(false);
  }

  return {
    results,
    scannedBrand,
    scanStats,
    loading,
    error,
    topProgress,
    topFailures,
    scan,
    scanTopDeals,
  };
}
