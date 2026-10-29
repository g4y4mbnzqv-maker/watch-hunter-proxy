import { POPULAR } from "@/lib/brands";

// Each brand costs about one scan's worth of eBay calls per Top deals run
export const MAX_TOP_BRANDS = 15;

const same = (a, b) => a.toLowerCase() === b.toLowerCase();

export function hasBrand(list, brand) {
  return list.some((name) => same(name, brand));
}

// Adds a brand at the end, or before the brand at index. Returns the same
// list when it's already there or the list is full.
export function addBrand(list, brand, index = list.length) {
  if (hasBrand(list, brand) || list.length >= MAX_TOP_BRANDS) return list;
  const next = [...list];
  next.splice(Math.max(0, Math.min(index, list.length)), 0, brand);
  return next;
}

// Keeps at least one brand, so Top deals always has something to scan
export function removeBrand(list, brand) {
  const next = list.filter((name) => !same(name, brand));
  return next.length ? next : list;
}

export function toggleBrand(list, brand) {
  return hasBrand(list, brand) ? removeBrand(list, brand) : addBrand(list, brand);
}

// Moves a brand already in the list to index
export function moveBrand(list, brand, index) {
  const from = list.findIndex((name) => same(name, brand));
  if (from < 0) return list;
  const next = list.filter((_, i) => i !== from);
  next.splice(Math.max(0, Math.min(index > from ? index - 1 : index, next.length)), 0, list[from]);
  return next;
}

// What's stored, tidied: strings only, no repeats, within the limit, and the
// popular brands when nothing usable is left
export function cleanTopBrands(stored) {
  if (!Array.isArray(stored)) return POPULAR;
  const kept = [];
  for (const name of stored) {
    if (typeof name === "string" && name.trim() && !hasBrand(kept, name.trim())) kept.push(name.trim());
  }
  return kept.length ? kept.slice(0, MAX_TOP_BRANDS) : POPULAR;
}
