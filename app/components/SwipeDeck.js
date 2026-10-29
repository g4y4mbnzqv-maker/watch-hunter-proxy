"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuctionCard from "./AuctionCard";
import { EmptyState } from "./Placeholders";
import { useStoredState } from "../client/hooks";
import { deckItems, pruneSkipped, swipeThreshold } from "../client/swipe";

// Movement before a press counts as a drag, so taps and scrolls still work
const DRAG_START_PX = 10;
// How long a swiped card takes to fly off
const EXIT_MS = 220;

// One listing at a time: swipe right to save, left to skip. Give it a new
// key to deal again from the top.
export default function SwipeDeck({ items, now, isSaved, onToggleSave, onSetResale, onShowCards }) {
  const [skipped, setSkipped] = useStoredState("wh-skipped", {});
  // Swiped since the deck opened, so saved listings leave the deck too
  const [done, setDone] = useState(() => new Set());
  const [history, setHistory] = useState([]);
  const [drag, setDrag] = useState({ dx: 0, active: false });
  const [exit, setExit] = useState(null);
  const card = useRef(null);
  const press = useRef(null);
  const dragged = useRef(false);

  useEffect(() => {
    const pruned = pruneSkipped(skipped, Date.now());
    if (pruned !== skipped) setSkipped(pruned);
  }, [skipped, setSkipped]);

  const deck = useMemo(() => deckItems(items, skipped, done), [items, skipped, done]);
  const [top, next] = deck;
  const skippedHere = items.filter((item) => skipped[item.itemId]).length;

  const decide = useCallback(
    (action) => {
      if (!top || exit) return;
      setExit(action);
      setTimeout(() => {
        const wasSaved = isSaved(top.itemId);
        if (action === "save" && !wasSaved) onToggleSave(top);
        if (action === "skip") setSkipped((current) => ({ ...current, [top.itemId]: Date.now() }));
        setDone((current) => new Set(current).add(top.itemId));
        setHistory((current) => [...current, { item: top, action, wasSaved }]);
        setDrag({ dx: 0, active: false });
        setExit(null);
      }, EXIT_MS);
    },
    [top, exit, isSaved, onToggleSave, setSkipped]
  );

  const undo = useCallback(() => {
    const last = history[history.length - 1];
    if (!last || exit) return;
    const { item, action, wasSaved } = last;
    if (action === "save" && !wasSaved && isSaved(item.itemId)) onToggleSave(item);
    if (action === "skip") {
      setSkipped((current) => {
        const nextSkipped = { ...current };
        delete nextSkipped[item.itemId];
        return nextSkipped;
      });
    }
    setDone((current) => {
      const nextDone = new Set(current);
      nextDone.delete(item.itemId);
      return nextDone;
    });
    setHistory((current) => current.slice(0, -1));
  }, [history, exit, isSaved, onToggleSave, setSkipped]);

  useEffect(() => {
    function onKey(e) {
      // Leave the keys to the photo viewer and to typing
      if (document.querySelector('[role="dialog"]')) return;
      if (e.target.closest?.("input, textarea, select")) return;
      if (e.key === "ArrowRight") decide("save");
      if (e.key === "ArrowLeft") decide("skip");
      if (e.key === "z" && !e.metaKey && !e.ctrlKey) undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, undo]);

  function onPointerDown(e) {
    // Photo viewer events bubble here through the portal; ignore them, and
    // presses that start in a text box
    if (exit || !e.currentTarget.contains(e.target) || e.target.closest("input, textarea, select")) return;
    press.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    dragged.current = false;
  }

  function onPointerMove(e) {
    const start = press.current;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!drag.active) {
      // A mostly vertical move is a scroll
      if (Math.abs(dy) > DRAG_START_PX && Math.abs(dy) > Math.abs(dx)) {
        press.current = null;
        return;
      }
      if (Math.abs(dx) < DRAG_START_PX) return;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      dragged.current = true;
    }
    setDrag({ dx, active: true });
  }

  function onPointerEnd() {
    if (!press.current) return;
    press.current = null;
    if (!drag.active) return;
    const width = card.current?.offsetWidth ?? 360;
    if (Math.abs(drag.dx) >= swipeThreshold(width)) decide(drag.dx > 0 ? "save" : "skip");
    else setDrag({ dx: 0, active: false });
  }

  if (!top) {
    return (
      <EmptyState
        title={items.length ? "You've been through them all." : "No listings match this view."}
        body={
          skippedHere > 0
            ? `${skippedHere} skipped ${skippedHere === 1 ? "listing is" : "listings are"} hidden from the deck. Saved ones are in your watchlist.`
            : "Saved listings are in your watchlist. Scan another brand for more."
        }
        action={skippedHere > 0 ? `Show ${skippedHere} skipped again` : "Back to cards"}
        onAction={() => {
          if (skippedHere > 0) {
            setSkipped((current) => {
              const kept = { ...current };
              for (const item of items) delete kept[item.itemId];
              return kept;
            });
            setDone(new Set());
            setHistory([]);
          } else {
            onShowCards();
          }
        }}
      />
    );
  }

  const offset = exit ? (exit === "save" ? 1 : -1) * 1.5 * (card.current?.offsetWidth ?? 400) : drag.dx;
  const lean = Math.max(-1, Math.min(1, offset / 120));

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-3 flex items-center justify-between text-xs text-zinc-400">
        <span className="tabular-nums">{deck.length} left</span>
        <span className="hidden sm:inline">← skip · save → · Z to undo</span>
        <span className="sm:hidden">Swipe left to skip, right to save</span>
      </div>

      <div className="grid">
        {next && (
          <div
            aria-hidden="true"
            className="pointer-events-none [grid-area:1/1] motion-safe:transition-transform"
            style={{ transform: `scale(${0.95 + 0.05 * Math.min(Math.abs(lean), 1)})`, opacity: 0.5 }}
          >
            <AuctionCard item={next} now={now} saved={isSaved(next.itemId)} onToggleSave={() => {}} onSetResale={() => {}} />
          </div>
        )}

        <div
          ref={card}
          key={top.itemId}
          className={`relative touch-pan-y select-none rounded-3xl bg-zinc-950 [grid-area:1/1] ${
            drag.active && !exit ? "" : "motion-safe:transition-transform motion-safe:duration-200"
          }`}
          style={{ transform: `translateX(${offset}px) rotate(${lean * 6}deg)` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          // Stops the browser dragging the photo itself, which cancels the swipe
          onDragStart={(e) => e.preventDefault()}
          onClickCapture={(e) => {
            // The end of a drag shouldn't also tap a button or link
            if (dragged.current) {
              e.preventDefault();
              e.stopPropagation();
              dragged.current = false;
            }
          }}
        >
          <AuctionCard item={top} now={now} saved={isSaved(top.itemId)} onToggleSave={onToggleSave} onSetResale={onSetResale} />
          <Stamp show={lean > 0} strength={lean} className="left-4 -rotate-12 text-emerald-300 ring-emerald-300">
            Save
          </Stamp>
          <Stamp show={lean < 0} strength={-lean} className="right-4 rotate-12 text-rose-300 ring-rose-300">
            Skip
          </Stamp>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-4">
        <RoundButton label="Skip" onClick={() => decide("skip")} className="h-14 w-14 text-rose-300 ring-rose-400/40 hover:bg-rose-500/10">
          <CrossIcon />
        </RoundButton>
        <RoundButton
          label="Undo"
          onClick={undo}
          disabled={!history.length}
          className="h-11 w-11 text-zinc-300 ring-white/15 hover:bg-white/5 disabled:opacity-30"
        >
          <UndoIcon />
        </RoundButton>
        <RoundButton label="Save to watchlist" onClick={() => decide("save")} className="h-14 w-14 text-emerald-300 ring-emerald-400/40 hover:bg-emerald-500/10">
          <BookmarkIcon />
        </RoundButton>
      </div>
    </div>
  );
}

function Stamp({ show, strength, className, children }) {
  if (!show) return null;
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute top-14 rounded-lg bg-zinc-950/60 px-3 py-1 text-2xl font-bold uppercase tracking-widest ring-2 backdrop-blur ${className}`}
      style={{ opacity: Math.min(strength * 1.2, 1) }}
    >
      {children}
    </span>
  );
}

function RoundButton({ label, onClick, disabled, className, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex items-center justify-center rounded-full bg-zinc-900/80 ring-1 transition ${className}`}
    >
      {children}
    </button>
  );
}

function CrossIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 010 12h-3" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z" />
    </svg>
  );
}
