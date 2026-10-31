"use client";

import { useCallback, useEffect, useState } from "react";
import { loadState, localStamp, onRemoteChange, reconcile, saveSoon, setLocalStamp } from "./sync";

// Re-renders on an interval so countdowns stay current
export function useNow(intervalMs) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

function readLocal(key) {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) : undefined;
  } catch {
    // Storage blocked or corrupt: keep the default
    return undefined;
  }
}

function writeLocal(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: the value still applies for this visit
  }
}

// useState that remembers its value in this browser. With sync, it is also
// saved to the database and kept the same on every device. The setter keeps
// the same identity between renders, so memoised children don't redraw.
export function useStoredState(key, initial, { sync = false } = {}) {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    const local = readLocal(key);
    if (local !== undefined) setValue(local);
    if (!sync) return;

    let cancelled = false;
    const take = (next, changedAt) => {
      setValue(next);
      writeLocal(key, next);
      setLocalStamp(key, changedAt);
    };
    const stopListening = onRemoteChange(key, (next, changedAt) => {
      if (changedAt > localStamp(key)) take(next, changedAt);
    });

    loadState().then((state) => {
      if (cancelled || !state) return;
      // Read again, in case something changed while the server answered
      const result = reconcile(key, readLocal(key), localStamp(key), state[key]);
      if (!result) return;
      take(result.value, result.changedAt);
      if (result.push) saveSoon(key, result.value, result.changedAt);
    });

    return () => {
      cancelled = true;
      stopListening();
    };
  }, [key, sync]);

  const update = useCallback(
    (next) => {
      setValue((current) => {
        const resolved = typeof next === "function" ? next(current) : next;
        writeLocal(key, resolved);
        if (sync) {
          const changedAt = Date.now();
          setLocalStamp(key, changedAt);
          saveSoon(key, resolved, changedAt);
        }
        return resolved;
      });
    },
    [key, sync]
  );

  return [value, update];
}
