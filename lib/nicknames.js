import { niche } from "./niche";

// Well-known model names and nicknames, used when a title has no reference
// number. Each family needs its brand (or an alias) in the title as well,
// so "Royal Oak" only means the Casio when the title says Casio or G-Shock.
// Longer phrases are checked first, so "King Turtle" wins over "Turtle".
const FAMILIES = niche.families;

// Turns "Sea-Dweller" into a pattern that also matches "Sea Dweller"
function phrasePattern(phrase) {
  const words = phrase
    .split(/[\s-]+/)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b${words.join("[\\s-]*")}\\b`, "i");
}

const MATCHERS = FAMILIES.map((family) => ({
  brand: family.brand,
  aliases: family.aliases.map(phrasePattern),
  names: [...family.names]
    .sort((a, b) => b.length - a.length)
    .map((name) => ({ name, pattern: phrasePattern(name) })),
}));

// Returns a model name such as "Seiko Turtle" when the title names a known
// family and its brand, or null
export function extractModelName(title) {
  if (!title) return null;

  for (const family of MATCHERS) {
    if (!family.aliases.some((alias) => alias.test(title))) continue;
    const match = family.names.find(({ pattern }) => pattern.test(title));
    if (match) {
      // Bikes add the groupset, which changes the price a lot
      const suffix = niche.nameSuffix?.(title);
      return [family.brand, match.name, suffix].filter(Boolean).join(" ");
    }
  }

  return null;
}
