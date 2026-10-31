// Details in a title that change what a watch is worth: its case size, and
// whether the case is solid gold or platinum rather than steel

// Case sizes outside this range are more likely strap widths or water depths
const MIN_CASE_MM = 20;
const MAX_CASE_MM = 55;
// Sizes this close count as the same watch
export const SIZE_TOLERANCE_MM = 2;

// The case size in millimetres, such as 40 from "40mm" or "39.5 mm", or null
export function caseSize(title) {
  for (const match of String(title ?? "").matchAll(/\b(\d{2}(?:\.\d)?)\s?mm\b/gi)) {
    const size = Number(match[1]);
    if (size >= MIN_CASE_MM && size <= MAX_CASE_MM) return size;
  }
  return null;
}

const PLATED = /\bgold[- ]?(plated|filled|tone|toned|capped)\b|\brolled gold\b|\bplated\b|\bgp\b/i;
const PRECIOUS = /\b(9|14|18|22)\s?(ct|k|kt|carat)\b|\bsolid gold\b|\bplatinum\b|\b(375|585|750)\b(?!\s?mm)/i;

// True for a solid gold or platinum case; plated and gold-tone don't count
export function isPrecious(title) {
  const text = String(title ?? "");
  return PRECIOUS.test(text) && !PLATED.test(text);
}

// The details to match on, or null when there's nothing to go on beyond
// "not precious metal"
export function caseDetails(title) {
  return { size: caseSize(title), precious: isPrecious(title) };
}

// True when a comparable listing could be the same watch: the same metal,
// and a size within the tolerance when both titles give one
export function detailsMatch(details, title) {
  if (isPrecious(title) !== details.precious) return false;
  if (details.size === null) return true;
  const size = caseSize(title);
  return size === null || Math.abs(size - details.size) <= SIZE_TOLERANCE_MM;
}
