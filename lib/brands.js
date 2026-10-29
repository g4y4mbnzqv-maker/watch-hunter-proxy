import { niche } from "./niche";

// Brands offered in the picker, from the app's niche file. POPULAR also
// drives Top deals and the daily price index harvest.
export const POPULAR = niche.popular;

export const MORE_GROUPS = niche.groups;

const ALL_BRANDS = [...POPULAR, ...MORE_GROUPS.flatMap((group) => group.brands)]
  // Longest first, so "Grand Seiko" wins over "Seiko"
  .sort((a, b) => b.length - a.length);

// The brand a title names, as spelt in the picker, or null
export function brandFromTitle(title) {
  const lower = ` ${String(title ?? "").toLowerCase().replace(/[^\p{L}\p{N}&-]+/gu, " ")} `;
  return ALL_BRANDS.find((brand) => lower.includes(` ${brand.toLowerCase()} `)) ?? null;
}
