"use client";

import { useEffect, useState } from "react";

// Keeps saved data the same on every device, through /api/state. Each value
// also lives in this browser, so the app works offline and without a
// database; the newest change to a key wins.

// Waits this long after a change before saving, so typing doesn't send a
// save per keystroke
const SAVE_DELAY_MS = 800;

let loading = null;
let status = "checking";
const statusListeners = new Set();
const keyListeners = new Map();
const pendingSaves = new Map();

function setStatus(next) {
  status = next;
  for (const listener of statusListeners) listener(next);
}

// "checking", "on", "no-passcode", "no-database" or "offline"
export function useSyncStatus() {
  const [current, setCurrent] = useState(status);
  useEffect(() => {
    statusListeners.add(setCurrent);
    setCurrent(status);
    return () => statusListeners.delete(setCurrent);
  }, []);
  return current;
}

// When this browser last changed a key, or 0 for data saved before syncing
export function localStamp(key) {
  try {
    return Number(window.localStorage.getItem(`${key}@changed`)) || 0;
  } catch {
    return 0;
  }
}

export function setLocalStamp(key, changedAt) {
  try {
    window.localStorage.setItem(`${key}@changed`, String(changedAt));
  } catch {
    // Storage blocked: syncing still works for this visit
  }
}

// Everything saved on the server, fetched once and shared by every key.
// Pass fresh to fetch again, such as when the app comes back into view.
export function loadState({ fresh = false } = {}) {
  if (loading && !fresh) return loading;
  loading = fetch("/api/state", { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data) {
        setStatus("offline");
        return null;
      }
      if (!data.enabled) {
        setStatus(data.reason ?? "no-database");
        return null;
      }
      setStatus("on");
      return data.state;
    })
    .catch(() => {
      setStatus("offline");
      return null;
    });
  return loading;
}

// Tells a key's hook about a newer value from another device
export function onRemoteChange(key, listener) {
  if (!keyListeners.has(key)) keyListeners.set(key, new Set());
  keyListeners.get(key).add(listener);
  return () => keyListeners.get(key).delete(listener);
}

function announce(key, value, changedAt) {
  for (const listener of keyListeners.get(key) ?? []) listener(value, changedAt);
}

// Saves a key shortly after its last change
export function saveSoon(key, value, changedAt) {
  if (status !== "on" && status !== "checking") return;
  clearTimeout(pendingSaves.get(key));
  pendingSaves.set(
    key,
    setTimeout(async () => {
      pendingSaves.delete(key);
      try {
        const res = await fetch("/api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value, changedAt }),
        });
        const data = await res.json();
        // Another device saved something newer meanwhile
        if (data && data.saved === false) announce(key, data.value, data.changedAt);
      } catch {
        setStatus("offline");
      }
    }, SAVE_DELAY_MS)
  );
}

// Lists and maps that grew on two devices before syncing was switched on
// are combined, so nothing saved on either is lost. Anything else takes the
// server's copy.
const COMBINABLE = new Set(["wh-watchlist", "wh-resale-overrides", "wh-model-values", "wh-skipped", "wh-deals"]);

export function combine(key, local, remote) {
  if (!COMBINABLE.has(key)) return remote;
  if (Array.isArray(local) && Array.isArray(remote)) {
    const ids = new Set(remote.map((entry) => entry?.id));
    return [...remote, ...local.filter((entry) => !ids.has(entry?.id))];
  }
  if (local && remote && typeof local === "object" && typeof remote === "object") {
    return { ...local, ...remote };
  }
  return remote;
}

// Works out what a key should hold once the server's copy is known.
// Returns { value, changedAt, push } where push says to send it to the
// server, or null to keep the local copy as it is.
export function reconcile(key, local, localChangedAt, remote) {
  if (!remote) {
    return local === undefined ? null : { value: local, changedAt: localChangedAt || Date.now(), push: true };
  }
  if (localChangedAt > remote.changedAt) return { value: local, changedAt: localChangedAt, push: true };
  if (localChangedAt === remote.changedAt) return null;
  // Data from before syncing started gets combined with the server's
  if (!localChangedAt && local !== undefined) {
    const value = combine(key, local, remote.value);
    const changed = JSON.stringify(value) !== JSON.stringify(remote.value);
    return { value, changedAt: changed ? Date.now() : remote.changedAt, push: changed };
  }
  return { value: remote.value, changedAt: remote.changedAt, push: false };
}

// Catches up with other devices when the app comes back into view
if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible" || status !== "on") return;
    const state = await loadState({ fresh: true });
    if (!state) return;
    for (const [key, entry] of Object.entries(state)) {
      if (entry.changedAt > localStamp(key)) announce(key, entry.value, entry.changedAt);
    }
  });
}
