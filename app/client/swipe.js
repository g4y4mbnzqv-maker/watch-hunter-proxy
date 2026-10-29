// Skipped watches are forgotten after this long; most listings have ended
export const SKIP_MEMORY_MS = 14 * 24 * 3_600_000;

// Listings still to swipe: not skipped, and not swiped since the deck opened
export function deckItems(items, skipped, done) {
  return items.filter((item) => !skipped[item.itemId] && !done.has(item.itemId));
}

// Drops skips older than SKIP_MEMORY_MS. Returns the same object when
// nothing is dropped, so callers can tell nothing changed.
export function pruneSkipped(skipped, now) {
  const kept = Object.entries(skipped).filter(([, at]) => now - at < SKIP_MEMORY_MS);
  return kept.length === Object.keys(skipped).length ? skipped : Object.fromEntries(kept);
}

// How far a card must be dragged to count as a swipe
export function swipeThreshold(width) {
  return Math.min(120, width * 0.3);
}
