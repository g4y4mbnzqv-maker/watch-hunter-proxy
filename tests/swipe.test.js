import { describe, expect, it } from "vitest";
import { SKIP_MEMORY_MS, deckItems, pruneSkipped, swipeThreshold } from "../app/client/swipe";

const items = ["a", "b", "c", "d"].map((itemId) => ({ itemId }));

describe("deckItems", () => {
  it("leaves out skipped and already swiped listings, keeping the order", () => {
    const deck = deckItems(items, { b: 1 }, new Set(["d"]));
    expect(deck.map((item) => item.itemId)).toEqual(["a", "c"]);
  });
});

describe("pruneSkipped", () => {
  const now = 1_000 * SKIP_MEMORY_MS;

  it("forgets skips older than the limit", () => {
    const pruned = pruneSkipped({ old: now - SKIP_MEMORY_MS, recent: now - 1000 }, now);
    expect(pruned).toEqual({ recent: now - 1000 });
  });

  it("returns the same object when nothing is old", () => {
    const skipped = { recent: now - 1000 };
    expect(pruneSkipped(skipped, now)).toBe(skipped);
  });
});

describe("swipeThreshold", () => {
  it("is 30% of a narrow card and at most 120px", () => {
    expect(swipeThreshold(300)).toBe(90);
    expect(swipeThreshold(600)).toBe(120);
  });
});
