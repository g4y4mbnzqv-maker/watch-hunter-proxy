"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ebayImage } from "@/lib/images";

// A swipe shorter than this counts as a tap
const SWIPE_PX = 40;

// Full-screen photo viewer for one listing
export default function Gallery({ images, title, onClose }) {
  const [index, setIndex] = useState(0);
  const touchStart = useRef(null);
  const count = images.length;

  const go = (step) => setIndex((current) => (current + step + count) % count);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    // Stop the page scrolling behind the viewer
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
    // go only changes with count, which is fixed while open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, count]);

  // Rendered at the top of the page so card effects can't clip it
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photos of ${title}`}
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95 backdrop-blur-xl"
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-4 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="line-clamp-1 text-sm text-zinc-300">{title}</p>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm tabular-nums text-zinc-400">
            {index + 1} / {count}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close photos"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-zinc-100 hover:bg-white/20"
          >
            ✕
          </button>
        </div>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-2"
        onTouchStart={(e) => {
          touchStart.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchStart.current === null) return;
          const distance = e.changedTouches[0].clientX - touchStart.current;
          touchStart.current = null;
          if (Math.abs(distance) > SWIPE_PX) go(distance < 0 ? 1 : -1);
        }}
      >
        <img
          key={images[index]}
          src={ebayImage(images[index], 1600)}
          alt={`Photo ${index + 1} of ${title}`}
          className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          onError={(e) => {
            // Fall back to eBay's own URL if the bigger copy won't load
            if (e.currentTarget.src !== images[index]) e.currentTarget.src = images[index];
          }}
        />

        {count > 1 && (
          <>
            <NavButton side="left" onClick={() => go(-1)} label="Previous photo" />
            <NavButton side="right" onClick={() => go(1)} label="Next photo" />
          </>
        )}
      </div>

      {count > 1 && (
        <div
          className="flex gap-2 overflow-x-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((url, thumb) => (
            <button
              key={url}
              type="button"
              onClick={() => setIndex(thumb)}
              aria-label={`Show photo ${thumb + 1}`}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-2 transition ${
                thumb === index ? "ring-emerald-400" : "opacity-60 ring-transparent hover:opacity-100"
              }`}
            >
              <img src={ebayImage(url, 140)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

function NavButton({ side, onClick, label }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`absolute top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl text-zinc-100 backdrop-blur hover:bg-white/20 sm:flex ${
        side === "left" ? "left-4" : "right-4"
      }`}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );
}
