"use client";

import { useEffect, useRef, useState } from "react";
import { MORE_GROUPS, POPULAR } from "@/lib/brands";
import { MAX_TOP_BRANDS, addBrand, hasBrand, moveBrand, removeBrand, toggleBrand } from "../client/topBrands";

export { POPULAR };

// A mouse drag starts after this much movement; a finger has to hold still
// this long first, so a swipe still scrolls the page
const MOUSE_DRAG_PX = 5;
const TOUCH_HOLD_MS = 300;
const TOUCH_SLOP_PX = 8;
// Dragging this close to the top or bottom of the screen scrolls the page,
// so a brand far down the list can reach the Top deals box
const EDGE_PX = 70;
const EDGE_SPEED_PX = 12;

const LIBRARY = [{ label: "Popular", brands: POPULAR }, ...MORE_GROUPS];

// Brand chips to scan from, led by your Top deals brands. "Edit" lets you
// drag brands into or out of Top deals, or tap to add and remove them.
export default function BrandPicker({ selected, disabled, onPick, topBrands, onTopBrandsChange }) {
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState(false);
  const { drag, startPress, wasDragged } = useChipDrag(topBrands, onTopBrandsChange);

  const others = LIBRARY.map((group) => ({
    ...group,
    brands: group.brands.filter((name) => !hasBrand(topBrands, name)),
  })).filter((group) => group.brands.length);

  function tap(name) {
    if (wasDragged()) return;
    if (editing) onTopBrandsChange(toggleBrand(topBrands, name));
    else onPick(name);
  }

  const chipProps = (name, from) => ({
    name,
    selected,
    editing,
    disabled: !editing && disabled,
    inTop: hasBrand(topBrands, name),
    dragging: drag?.brand === name,
    onTap: () => tap(name),
    onPointerDown: editing ? (e) => startPress(e, name, from) : undefined,
  });

  if (!editing) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {topBrands.map((name) => (
            <BrandChip key={name} {...chipProps(name, "tray")} />
          ))}
          <button
            type="button"
            onClick={() => setShowAll((open) => !open)}
            aria-expanded={showAll}
            className="rounded-full px-3 py-1 text-xs font-medium text-emerald-300 hover:text-emerald-200"
          >
            {showAll ? "Fewer brands" : "All brands"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full px-3 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200"
          >
            Edit Top deals
          </button>
        </div>

        {showAll &&
          others.map((group) => (
            <Group key={group.label} label={group.label}>
              {group.brands.map((name) => (
                <BrandChip key={name} {...chipProps(name, "library")} />
              ))}
            </Group>
          ))}
      </div>
    );
  }

  const full = topBrands.length >= MAX_TOP_BRANDS;
  const trayItems = [...topBrands];
  // Shows where a dragged brand will land
  if (drag?.over === "tray") trayItems.splice(drag.index, 0, null);

  return (
    <div className="space-y-4">
      <div
        data-drop-zone="tray"
        className={`rounded-2xl border border-dashed p-3 transition ${
          drag?.over === "tray" ? "border-emerald-400/70 bg-emerald-400/5" : "border-white/15"
        }`}
      >
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span className="text-sm font-medium text-zinc-100">Top deals</span>
            <span className="ml-2 text-xs tabular-nums text-zinc-500">
              {topBrands.length} of {MAX_TOP_BRANDS} brands
            </span>
          </div>
          <div className="flex gap-3 text-xs">
            <button type="button" onClick={() => onTopBrandsChange(POPULAR)} className="text-zinc-400 hover:text-zinc-200">
              Reset
            </button>
            <button type="button" onClick={() => setEditing(false)} className="font-semibold text-emerald-300 hover:text-emerald-200">
              Done
            </button>
          </div>
        </div>
        <div className="flex min-h-9 flex-wrap gap-2">
          {trayItems.map((name, index) =>
            name === null ? (
              <span key="drop-here" className="rounded-full border border-dashed border-emerald-400/70 px-3 py-1 text-xs text-emerald-300">
                {drag.brand}
              </span>
            ) : (
              <BrandChip key={name} trayIndex={drag?.over === "tray" && index > drag.index ? index - 1 : index} {...chipProps(name, "tray")} />
            )
          )}
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">
          Drag brands in or out, or tap one to add or remove it. Each brand adds roughly one scan's worth of eBay calls
          to a Top deals run.
          {full && ` The limit is ${MAX_TOP_BRANDS} brands.`}
        </p>
        <CustomBrand topBrands={topBrands} onTopBrandsChange={onTopBrandsChange} disabled={full} />
      </div>

      {others.map((group) => (
        <Group key={group.label} label={group.label}>
          {group.brands.map((name) => (
            <BrandChip key={name} {...chipProps(name, "library")} />
          ))}
        </Group>
      ))}

      {drag?.active && (
        <span
          aria-hidden="true"
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-950 shadow-xl ring-2 ring-emerald-400"
          style={{ left: drag.x, top: drag.y }}
        >
          {drag.brand}
        </span>
      )}
    </div>
  );
}

function Group({ label, children }) {
  return (
    <div>
      <div className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

// For a brand that isn't in the lists
function CustomBrand({ topBrands, onTopBrandsChange, disabled }) {
  const [name, setName] = useState("");
  return (
    <form
      className="mt-3 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onTopBrandsChange(addBrand(topBrands, name.trim()));
        setName("");
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={disabled}
        placeholder="Another brand"
        aria-label="Add another brand to Top deals"
        className="min-w-0 flex-1 rounded-full bg-black/30 px-3 py-1.5 text-xs text-zinc-100 outline-none ring-1 ring-white/10 placeholder:text-zinc-500 focus:ring-emerald-400/50 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || !name.trim()}
        className="rounded-full px-3 py-1.5 text-xs font-medium text-zinc-200 ring-1 ring-white/10 hover:bg-white/5 disabled:opacity-40"
      >
        Add
      </button>
    </form>
  );
}

function BrandChip({ name, selected, disabled, editing, inTop, dragging, trayIndex, onTap, onPointerDown }) {
  const active = !editing && selected?.toLowerCase() === name.toLowerCase();

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onTap}
      onPointerDown={onPointerDown}
      onDragStart={(e) => e.preventDefault()}
      data-tray-index={editing && inTop ? trayIndex : undefined}
      data-brand={name}
      aria-pressed={editing ? inTop : undefined}
      aria-label={editing ? `${name}: ${inTop ? "in" : "not in"} Top deals` : undefined}
      className={`select-none rounded-full px-3 py-1 text-xs ring-1 transition ${dragging ? "opacity-30" : ""} ${
        editing ? "cursor-grab active:cursor-grabbing" : ""
      } ${
        active
          ? "bg-white text-zinc-950 ring-white"
          : editing && inTop
          ? "bg-emerald-400/15 text-emerald-200 ring-emerald-400/40"
          : "text-zinc-300 ring-white/10 hover:bg-white/5 hover:ring-white/20"
      }`}
    >
      {name}
      {editing && <span className="ml-1.5 opacity-60" aria-hidden="true">{inTop ? "✕" : "+"}</span>}
    </button>
  );
}

// Dragging chips with the mouse, pen or finger. Pointer events work the same
// on phones and computers, where the browser's own drag and drop doesn't.
function useChipDrag(topBrands, onTopBrandsChange) {
  const [drag, setDrag] = useState(null);
  const latest = useRef(null);
  latest.current = { topBrands, onTopBrandsChange };
  // Made once, so the page listeners added and removed are the same ones
  const controller = useRef(null);
  if (!controller.current) controller.current = createDragController(latest, setDrag);

  useEffect(() => () => controller.current.stop(), []);

  return { drag, startPress: controller.current.startPress, wasDragged: controller.current.wasDragged };
}

function createDragController(latest, setDrag) {
  let press = null;
  let dragged = false;

  function stop() {
    if (!press) return;
    clearTimeout(press.timer);
    cancelAnimationFrame(press.frame);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("touchmove", blockScroll);
    press = null;
  }

  function begin(x, y) {
    press.active = true;
    dragged = true;
    // Once dragging, a finger moves the chip and not the page
    window.addEventListener("touchmove", blockScroll, { passive: false });
    update(x, y);
    press.frame = requestAnimationFrame(edgeScroll);
  }

  function edgeScroll() {
    if (!press?.active) return;
    const { lastX, lastY } = press;
    const step = lastY < EDGE_PX ? -EDGE_SPEED_PX : lastY > window.innerHeight - EDGE_PX ? EDGE_SPEED_PX : 0;
    if (step) {
      window.scrollBy(0, step);
      // What's under the finger changes as the page moves
      update(lastX, lastY);
    }
    press.frame = requestAnimationFrame(edgeScroll);
  }

  function update(x, y) {
    press.lastX = x;
    press.lastY = y;
    const target = document.elementFromPoint(x, y);
    const over = target?.closest("[data-drop-zone]")?.dataset.dropZone ?? null;
    press.over = over;
    press.index = over === "tray" ? dropIndex(x, y, press.brand) : null;
    setDrag({ brand: press.brand, from: press.from, active: true, x, y, over, index: press.index });
  }

  function onMove(e) {
    if (!press || e.pointerId !== press.id) return;
    if (press.active) return update(e.clientX, e.clientY);
    const distance = Math.hypot(e.clientX - press.x, e.clientY - press.y);
    if (press.touch) {
      // Moving before the hold is up is a scroll
      if (distance > TOUCH_SLOP_PX) stop();
    } else if (distance > MOUSE_DRAG_PX) {
      begin(e.clientX, e.clientY);
    }
  }

  function onUp(e) {
    if (!press || e.pointerId !== press.id) return;
    if (press.active) {
      const { topBrands: list, onTopBrandsChange: change } = latest.current;
      if (press.over === "tray") {
        change(press.from === "tray" ? moveBrand(list, press.brand, press.index) : addBrand(list, press.brand, press.index));
      } else if (press.from === "tray") {
        change(removeBrand(list, press.brand));
      }
    }
    stop();
    setDrag(null);
  }

  function onCancel() {
    stop();
    setDrag(null);
  }

  function startPress(e, brand, from) {
    if (e.button > 0) return;
    stop();
    dragged = false;
    const touch = e.pointerType === "touch";
    press = { id: e.pointerId, brand, from, x: e.clientX, y: e.clientY, touch, active: false };
    if (touch) {
      press.timer = setTimeout(() => {
        if (press && !press.active) begin(press.x, press.y);
      }, TOUCH_HOLD_MS);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  }

  // The tap that ends a drag shouldn't also add or remove the brand
  function wasDragged() {
    const was = dragged;
    dragged = false;
    return was;
  }

  return { startPress, wasDragged, stop };
}

function blockScroll(e) {
  e.preventDefault();
}

// Where in the tray a chip dropped at x, y should go: after every chip whose
// middle comes before it in reading order
function dropIndex(x, y, brand) {
  const chips = [...document.querySelectorAll("[data-tray-index]")].filter((chip) => chip.dataset.brand !== brand);
  let index = 0;
  for (const chip of chips) {
    const rect = chip.getBoundingClientRect();
    const middleX = rect.left + rect.width / 2;
    const before = rect.bottom < y || (rect.top <= y && middleX < x);
    if (before) index = Number(chip.dataset.trayIndex) + 1;
  }
  return index;
}
