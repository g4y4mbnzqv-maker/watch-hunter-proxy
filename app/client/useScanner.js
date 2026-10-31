"use client";

import { useEffect, useState } from "react";
import { runPool } from "./listings";

// Label used in place of a brand once a Top deals scan has run
export const TOP_DEALS = "Top deals";
// ...and once a hidden gems search has run
export const HIDDEN_GEMS = "Hidden gems";
// Brands scanned at once by Top deals, to stay gentle on the eBay API
const TOP_DEALS_CONCURRENCY = 3;
// The last scan is shown again on reopening the app for this long
const LAST_SCAN_MS = 12 * 60 * 60_000;
const LAST_SCAN_KEY = "wh-last-scan";

// Keeps the last scan in this browser, so reopening the app shows it at
// once. Skipped quietly if it doesn't fit or storage is blocked.
function rememberScan(scan) {
  try {
    window.localStorage.setItem(LAST_SCAN_KEY, JSON.stringify({ ...scan, savedAt: Date.now() }));
  } catch {
    // Too big for storage, or storage blocked: the app works without it
  }
}

function recallScan() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(LAST_SCAN_KEY));
    return saved && Date.now() - saved.savedAt < LAST_SCAN_MS ? saved : null;
  } catch {
    return null;
  }
}

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
  // When the results on screen came from a scan before this visit
  const [restoredAt, setRestoredAt] = useState(null);

  useEffect(() => {
    const saved = recallScan();
    if (!saved) return;
    setResults(saved.results);
    setScannedBrand(saved.scannedBrand);
    setScanStats(saved.scanStats ?? null);
    setTopFailures(saved.topFailures ?? []);
    setRestoredAt(saved.savedAt);
  }, []);

  async function fetchBrand(query, { gems = false } = {}) {
    const params = new URLSearchParams({ brand: query, types: listingTypes.join(",") });
    if (gems) params.set("gems", "1");
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
      setRestoredAt(null);
      rememberScan({ results: data.results, scannedBrand: query, scanStats: data.stats ?? null });
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

  // Scans every brand given and combines the results. With gems, runs the
  // hidden gems searches instead, under that label.
  async function scanTopDeals(brands, { gems = false } = {}) {
    setLoading(true);
    setError(null);
    setTopFailures([]);
    setTopProgress({ done: 0, total: brands.length, gems });

    const found = {};
    const failures = [];
    let done = 0;
    let limited = false;

    // Starts the next brand as soon as one finishes
    await runPool(brands, TOP_DEALS_CONCURRENCY, async (name) => {
      try {
        // Once eBay refuses calls, the remaining brands would only fail too
        if (limited) throw Object.assign(new Error("Not scanned"), { skipped: true });
        found[name] = (await fetchBrand(name, { gems })).results;
      } catch (err) {
        if (!err.skipped) console.error(err);
        if (err.limitReached) limited = true;
        failures.push({ name, message: err.message });
      } finally {
        done += 1;
        setTopProgress({ done, total: brands.length, gems });
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
          if (!combined.has(item.itemId)) combined.set(item.itemId, gems ? item : { ...item, brand: name });
        }
      }
      const combinedResults = [...combined.values()];
      const failed = brands.filter((name) => failures.some((failure) => failure.name === name));
      setResults(combinedResults);
      const label = gems ? HIDDEN_GEMS : TOP_DEALS;
      setScannedBrand(label);
      setScanStats(null);
      setTopFailures(failed);
      setRestoredAt(null);
      rememberScan({ results: combinedResults, scannedBrand: label, scanStats: null, topFailures: failed });
      onScanned({ topDeals: !gems, gems });
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
    restoredAt,
    scan,
    scanTopDeals,
  };
}
