"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatGbp } from "./format";

// Validated against the dark chart surface (blue and orange, dark steps)
const ASKING = "#3987e5";
const CLOSES = "#d95926";
const SURFACE = "#18181b";
const GRID = "rgba(255,255,255,0.07)";

const HEIGHT = 280;
const PAD = { top: 16, right: 16, bottom: 28, left: 56 };

const toMs = (day) => new Date(`${day}T12:00:00Z`).getTime();
const shortDate = (day) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

// Asking prices as a median line over a low-to-high band, with auction
// closes as dots, on one price axis
export default function PriceChart({ asking, closes }) {
  const box = useRef(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const element = box.current;
    if (!element || !("ResizeObserver" in window)) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(entry.contentRect.width, 280)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const days = useMemo(
    () => [...new Set([...asking.map((point) => point.day), ...closes.map((point) => point.day)])].sort(),
    [asking, closes]
  );

  const scales = useMemo(() => {
    if (!days.length) return null;
    const values = [
      ...asking.flatMap((point) => [point.low, point.high]),
      ...closes.map((point) => point.median),
    ];
    const [min, max] = [Math.min(...values), Math.max(...values)];
    const padding = (max - min || max || 1) * 0.08;
    const ticks = niceTicks(Math.max(min - padding, 0), max + padding);
    const [start, end] = [toMs(days[0]), toMs(days[days.length - 1])];
    const plotWidth = width - PAD.left - PAD.right;
    const plotHeight = HEIGHT - PAD.top - PAD.bottom;
    // A single day sits in the middle
    const x = (day) =>
      end === start ? PAD.left + plotWidth / 2 : PAD.left + ((toMs(day) - start) / (end - start)) * plotWidth;
    const yMin = ticks[0];
    const yMax = ticks[ticks.length - 1];
    const y = (value) => PAD.top + (1 - (value - yMin) / (yMax - yMin)) * plotHeight;
    return { x, y, ticks, plotWidth, plotHeight };
  }, [days, asking, closes, width]);

  if (!scales) return null;
  const { x, y, ticks } = scales;

  const line = asking.map((point, index) => `${index ? "L" : "M"}${x(point.day)},${y(point.median)}`).join("");
  const band =
    asking.length > 1
      ? `M${asking.map((point) => `${x(point.day)},${y(point.high)}`).join("L")}L${[...asking]
          .reverse()
          .map((point) => `${x(point.day)},${y(point.low)}`)
          .join("L")}Z`
      : null;

  const xTicks = pickXTicks(days, Math.max(2, Math.floor(scales.plotWidth / 110)));
  const askingBy = new Map(asking.map((point) => [point.day, point]));
  const closesBy = new Map(closes.map((point) => [point.day, point]));
  const hovered = hover !== null ? days[hover] : null;

  function nearestDay(clientX) {
    const rect = box.current.getBoundingClientRect();
    const position = clientX - rect.left;
    let best = 0;
    days.forEach((day, index) => {
      if (Math.abs(x(day) - position) < Math.abs(x(days[best]) - position)) best = index;
    });
    return best;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-300">
        <span className="flex items-center gap-2">
          <svg width="18" height="10" aria-hidden="true">
            <rect x="0" y="1" width="18" height="8" rx="2" fill={ASKING} opacity="0.15" />
            <line x1="1" y1="5" x2="17" y2="5" stroke={ASKING} strokeWidth="2" strokeLinecap="round" />
          </svg>
          Asking price: median, with low to high range
        </span>
        {closes.length > 0 && (
          <span className="flex items-center gap-2">
            <svg width="10" height="10" aria-hidden="true">
              <circle cx="5" cy="5" r="4" fill={CLOSES} />
            </svg>
            Auction closes: median bid in the last hour
          </span>
        )}
      </div>

      <div
        ref={box}
        className="relative touch-pan-y select-none outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
        tabIndex={0}
        role="img"
        aria-label={`Price history over ${days.length} days. Use the arrow keys to step through days.`}
        onPointerMove={(e) => setHover(nearestDay(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setHover((index) => Math.min((index ?? -1) + 1, days.length - 1));
          if (e.key === "ArrowLeft") setHover((index) => Math.max((index ?? days.length) - 1, 0));
          if (e.key === "Escape") setHover(null);
        }}
        onBlur={() => setHover(null)}
      >
        <svg width={width} height={HEIGHT} className="block">
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke={GRID} strokeWidth="1" />
              <text x={PAD.left - 10} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-zinc-500 text-[11px] tabular-nums">
                {formatGbp(tick)}
              </text>
            </g>
          ))}
          {xTicks.map((day) => (
            <text key={day} x={x(day)} y={HEIGHT - 8} textAnchor="middle" className="fill-zinc-500 text-[11px]">
              {shortDate(day)}
            </text>
          ))}

          {band && <path d={band} fill={ASKING} opacity="0.1" />}
          {asking.length > 1 && (
            <path d={line} fill="none" stroke={ASKING} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {asking.length === 1 && (
            <circle cx={x(asking[0].day)} cy={y(asking[0].median)} r="4" fill={ASKING} stroke={SURFACE} strokeWidth="2" />
          )}

          {hovered && (
            <line
              x1={x(hovered)}
              x2={x(hovered)}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="1"
            />
          )}
          {hovered && askingBy.has(hovered) && (
            <circle cx={x(hovered)} cy={y(askingBy.get(hovered).median)} r="4.5" fill={ASKING} stroke={SURFACE} strokeWidth="2" />
          )}

          {closes.map((point) => (
            <circle
              key={point.day}
              cx={x(point.day)}
              cy={y(point.median)}
              r={hovered === point.day ? 5.5 : 4}
              fill={CLOSES}
              stroke={SURFACE}
              strokeWidth="2"
            />
          ))}
        </svg>

        {hovered && (
          <Tooltip
            day={hovered}
            asking={askingBy.get(hovered)}
            close={closesBy.get(hovered)}
            left={x(hovered)}
            width={width}
          />
        )}
      </div>
    </div>
  );
}

function Tooltip({ day, asking, close, left, width }) {
  // Keep the tooltip inside the chart
  const flip = left > width - 200;
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 w-48 rounded-xl bg-zinc-950/95 p-3 text-xs shadow-xl ring-1 ring-white/10"
      style={flip ? { right: width - left + 10 } : { left: left + 10 }}
    >
      <div className="mb-1.5 font-medium text-zinc-100">
        {new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
      </div>
      {asking ? (
        <Row swatch={<span className="h-0.5 w-3 rounded" style={{ background: ASKING }} />} label="Asking">
          {formatGbp(asking.median)}
          <span className="block text-[11px] text-zinc-500">
            {formatGbp(asking.low)} to {formatGbp(asking.high)}, {asking.listings} listings
          </span>
        </Row>
      ) : (
        <p className="text-zinc-500">No asking prices this day</p>
      )}
      {close && (
        <Row swatch={<span className="h-2 w-2 rounded-full" style={{ background: CLOSES }} />} label="Closes">
          {formatGbp(close.median)}
          <span className="block text-[11px] text-zinc-500">
            {close.count} {close.count === 1 ? "auction" : "auctions"}
          </span>
        </Row>
      )}
    </div>
  );
}

function Row({ swatch, label, children }) {
  return (
    <div className="mt-1 flex items-start gap-2">
      <span className="mt-1.5 flex w-3 justify-center">{swatch}</span>
      <span className="w-12 text-zinc-400">{label}</span>
      <span className="flex-1 text-right tabular-nums text-zinc-100">{children}</span>
    </div>
  );
}

// About five round-number price gridlines covering min to max
function niceTicks(min, max) {
  const span = max - min || 1;
  const rough = span / 5;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((candidate) => candidate >= rough);
  const start = Math.floor(min / step) * step;
  const ticks = [];
  for (let value = start; value <= max + step * 0.5; value += step) ticks.push(Math.round(value * 100) / 100);
  return ticks.length > 1 ? ticks : [start, start + step];
}

// Evenly spaced date labels, always including the first and last day
function pickXTicks(days, count) {
  if (days.length <= count) return days;
  const ticks = [];
  for (let index = 0; index < count; index++) {
    ticks.push(days[Math.round((index * (days.length - 1)) / (count - 1))]);
  }
  return [...new Set(ticks)];
}
