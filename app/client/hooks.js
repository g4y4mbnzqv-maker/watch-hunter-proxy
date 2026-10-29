"use client";

import { useCallback, useEffect, useState } from "react";

// Re-renders on an interval so countdowns stay current
export function useNow(intervalMs) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

// useState that remembers its value in this browser. The setter keeps the
// same identity between renders, so memoised children don't redraw.
export function useStoredState(key, initial) {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) setValue(JSON.parse(stored));
    } catch {
      // Storage blocked or corrupt: keep the default
    }
  }, [key]);

  const update = useCallback(
    (next) => {
      setValue((current) => {
        const resolved = typeof next === "function" ? next(current) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // Storage blocked: the value still applies for this visit
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, update];
}
