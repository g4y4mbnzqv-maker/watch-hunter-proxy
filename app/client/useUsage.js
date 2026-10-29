"use client";

import { useCallback, useEffect, useState } from "react";

// The eBay usage meter, and whether scans are paused because eBay has
// refused calls for using up the allowance
export function useUsage(now) {
  const [usage, setUsage] = useState(null);
  const [limitHit, setLimitHit] = useState(false);

  // The meter is a nice-to-have, so any failure just hides it
  const refreshUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/usage");
      const data = await res.json();
      setUsage(res.ok && !data.error ? data.usage : null);
    } catch {
      setUsage(null);
    }
  }, []);

  useEffect(() => {
    refreshUsage();
  }, [refreshUsage]);

  const resetAt = usage?.reset ? new Date(usage.reset).getTime() : null;
  // Paused from the first refused call, or when the meter shows nothing
  // left, until eBay's reset time passes
  const limitPaused =
    Boolean(limitHit || (usage && usage.remaining <= 0)) && !(resetAt && now >= resetAt);

  useEffect(() => {
    if (limitHit && resetAt && now >= resetAt) setLimitHit(false);
  }, [limitHit, resetAt, now]);

  const markLimitHit = useCallback(() => {
    setLimitHit(true);
    refreshUsage();
  }, [refreshUsage]);

  return {
    usage,
    resetAt,
    limitPaused,
    refreshUsage,
    markLimitHit,
    clearLimit: () => setLimitHit(false),
  };
}
