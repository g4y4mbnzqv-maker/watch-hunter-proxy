"use client";

import { useCallback, useEffect, useState } from "react";
import { trendMap } from "@/lib/indexKey";

// 30-day price changes from the price index, by model, for the cards.
// Empty when there's no database or no history yet.
export function useTrends() {
  const [trends, setTrends] = useState({});

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/index", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.enabled) setTrends(trendMap(data.models));
    } catch {
      // Trends are extra; the cards work without them
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { trends, refreshTrends: refresh };
}
