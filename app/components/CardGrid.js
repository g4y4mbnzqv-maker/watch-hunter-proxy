"use client";

import { useEffect, useRef, useState } from "react";
import AuctionCard from "./AuctionCard";

// Cards drawn at first, and added each time the end of the grid comes near
const PAGE_SIZE = 24;

// Draws listings a page at a time, so a big Top deals result stays quick.
// Give it a new key to start again from the first page.
export default function CardGrid({ items, now, isSaved, onToggleSave, onSetResale, onLogPurchase }) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const sentinel = useRef(null);
  const more = items.length - shown;

  useEffect(() => {
    const target = sentinel.current;
    if (!target || more <= 0 || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setShown((count) => count + PAGE_SIZE);
      },
      // Start drawing the next page a little before it scrolls into view
      { rootMargin: "800px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [more]);

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.slice(0, shown).map((item) => (
          <AuctionCard
            key={item.itemId}
            item={item}
            now={now}
            saved={isSaved(item.itemId)}
            onToggleSave={onToggleSave}
            onSetResale={onSetResale}
            onLogPurchase={onLogPurchase}
          />
        ))}
      </div>
      {more > 0 && (
        <div ref={sentinel} className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setShown((count) => count + PAGE_SIZE)}
            className="rounded-full px-4 py-2 text-sm font-medium text-zinc-300 ring-1 ring-white/10 hover:bg-white/5"
          >
            Show {Math.min(more, PAGE_SIZE)} more of {more}
          </button>
        </div>
      )}
    </>
  );
}
