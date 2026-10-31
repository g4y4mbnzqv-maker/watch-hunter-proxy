"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStoredState } from "./hooks";
import { SNAPSHOT_FIELDS, SORTERS, analyseAll, endsWithin, isLive, notify, pick } from "./listings";

// Saved listings with this many minutes left go in the ending-soon banner
// and, if alerts are on, trigger a notification
const ENDING_SOON_MINUTES = 10;

// Saved listings, their refresh from eBay, and ending-soon alerts
export function useWatchlist({ settings, resaleOverride, now, onLimitHit, onRefreshed }) {
  const [watchlist, setWatchlist] = useStoredState("wh-watchlist", {}, { sync: true });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);
  const [refreshedAt, setRefreshedAt] = useState(null);
  const [alertsOn, setAlertsOn] = useStoredState("wh-alerts", false);
  // Item IDs already notified, so each auction alerts once
  const [alerted, setAlerted] = useStoredState("wh-alerted", {});
  const [alertNote, setAlertNote] = useState(null);

  const toggleSave = useCallback(
    (item) => {
      setWatchlist((current) => {
        const next = { ...current };
        if (next[item.itemId]) {
          delete next[item.itemId];
        } else {
          next[item.itemId] = { ...pick(item, SNAPSHOT_FIELDS), savedAt: Date.now() };
        }
        return next;
      });
    },
    [setWatchlist]
  );

  async function refresh() {
    const ids = Object.keys(watchlist).filter((id) => !watchlist[id].ended);
    if (!ids.length) return;

    setRefreshing(true);
    setRefreshError(null);

    try {
      const res = await fetch(`/api/items?${new URLSearchParams({ ids: ids.join(",") })}`);
      const data = await res.json();

      if (data.limitReached) onLimitHit();
      if (!res.ok || data.error) {
        throw Object.assign(new Error(data.message || `Refresh failed (${res.status})`), {
          limitReached: Boolean(data.limitReached),
        });
      }

      setWatchlist((current) => {
        const next = { ...current };
        for (const item of data.items) {
          if (!next[item.itemId]) continue;
          // Keep the resale comparables from when it was saved
          next[item.itemId] = {
            ...next[item.itemId],
            ...pick(item, SNAPSHOT_FIELDS.filter((field) => field !== "comps")),
          };
        }
        for (const itemId of data.missing) {
          if (next[itemId]) next[itemId] = { ...next[itemId], ended: true };
        }
        return next;
      });
      setRefreshedAt(Date.now());
      onRefreshed();
    } catch (err) {
      console.error(err);
      if (!err.limitReached) setRefreshError(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  function clearEnded() {
    setWatchlist((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([, item]) => !item.ended && isLive(item, Date.now()))
      )
    );
  }

  const analysed = useMemo(
    () => analyseAll(Object.values(watchlist), settings, resaleOverride),
    [watchlist, settings, resaleOverride]
  );

  const items = useMemo(
    () =>
      analysed
        .map((item) => ({ ...item, ended: Boolean(item.ended) || !isLive(item, now) }))
        // Live listings first, ending soonest; then ended ones, latest first
        .sort((a, b) =>
          a.ended !== b.ended ? a.ended - b.ended : a.ended ? -SORTERS.ending(a, b) : SORTERS.ending(a, b)
        ),
    [analysed, now]
  );

  const endingSoon = useMemo(
    () => items.filter((item) => !item.ended && endsWithin(item, now, ENDING_SOON_MINUTES / 60)),
    [items, now]
  );

  async function enableAlerts() {
    if (!("Notification" in window)) {
      setAlertNote(
        "This browser can't show alerts. Auctions ending soon will still appear at the top of the page."
      );
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setAlertsOn(true);
      setAlertNote(null);
    } else {
      setAlertNote(
        "Notifications are blocked for this site. Allow them in your browser settings to get alerts."
      );
    }
  }

  useEffect(() => {
    if (!alertsOn || !("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    const fresh = endingSoon.filter((item) => !alerted[item.itemId]);
    if (!fresh.length) return;

    fresh.forEach((item) => notify(item, now));
    setAlerted((current) => {
      // Forget listings no longer on the watchlist so the list stays small
      const next = Object.fromEntries(Object.entries(current).filter(([itemId]) => watchlist[itemId]));
      fresh.forEach((item) => {
        next[item.itemId] = true;
      });
      return next;
    });
    // alerted and watchlist are read for de-duplication only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertsOn, endingSoon]);

  return {
    watchlist,
    items,
    endedCount: items.filter((item) => item.ended).length,
    endingSoon,
    refreshing,
    refreshError,
    refreshedAt,
    refresh,
    clearEnded,
    toggleSave,
    alertsOn,
    alertNote,
    enableAlerts,
    disableAlerts: () => setAlertsOn(false),
  };
}
