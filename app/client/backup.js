"use client";

import { SYNCED_KEYS } from "@/lib/syncedKeys";
import { localStamp, setLocalStamp } from "./sync";
import { readJson } from "./readJson";

// One file holding everything you've saved: watchlist, wanted list, sales
// log, settings, resale values and choices. Restoring it puts it all back,
// on this device and, with syncing on, on your others.

const BACKUP_APP = "watch-hunter";
const BACKUP_VERSION = 1;

export function makeBackup(now = new Date()) {
  const data = {};
  for (const key of SYNCED_KEYS) {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) data[key] = JSON.parse(stored);
    } catch {
      // Unreadable entry: leave it out
    }
  }
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}

const LAST_BACKUP_KEY = "wh-last-backup";

// When this browser last downloaded a backup, or null
export function lastBackupAt() {
  try {
    return Number(window.localStorage.getItem(LAST_BACKUP_KEY)) || null;
  } catch {
    return null;
  }
}

export function downloadBackup() {
  const backup = makeBackup();
  try {
    window.localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
  } catch {
    // Storage blocked: the dashboard just won't know
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `watch-hunter-backup-${backup.exportedAt.slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Checks a backup file's contents. Returns { data, exportedAt } with only
// the keys the app knows, or throws with a message saying what's wrong.
export function readBackup(text) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a Watch Hunter backup.");
  }
  if (backup?.app !== BACKUP_APP || typeof backup.data !== "object" || !backup.data) {
    throw new Error("That file isn't a Watch Hunter backup.");
  }
  if (backup.version > BACKUP_VERSION) {
    throw new Error("That backup is from a newer version of the app. Refresh the app and try again.");
  }
  const data = Object.fromEntries(Object.entries(backup.data).filter(([key]) => SYNCED_KEYS.includes(key)));
  return { data, exportedAt: backup.exportedAt ?? null };
}

// Puts a backup's data back in this browser, then sends it to the server
// so your other devices get it too. Returns how many items were restored.
export async function restoreBackup(data) {
  const changedAt = Date.now();
  for (const [key, value] of Object.entries(data)) {
    window.localStorage.setItem(key, JSON.stringify(value));
    setLocalStamp(key, Math.max(changedAt, localStamp(key) + 1));
  }
  await Promise.all(
    Object.entries(data).map(([key, value]) =>
      fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value, changedAt: localStamp(key) }),
      })
        .then(readJson)
        .catch(() => null)
    )
  );
  return Object.keys(data).length;
}
