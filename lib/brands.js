// Brands offered in the picker. POPULAR also drives Top deals and the
// daily price index harvest, so it is shared with server code.
export const POPULAR = ["Seiko", "Citizen", "Orient", "Casio", "Swatch", "Tissot", "Hamilton", "Omega", "Rolex"];

export const MORE_GROUPS = [
  {
    label: "Everyday and vintage",
    brands: [
      "Timex", "Bulova", "Accurist", "Rotary", "Sekonda", "Smiths", "Lorus", "Pulsar", "Fossil",
      "Vostok", "Poljot", "Raketa", "Roamer", "Avia", "Ingersoll", "Services",
    ],
  },
  {
    label: "Mid-range",
    brands: [
      "Longines", "TAG Heuer", "Oris", "Certina", "Mido", "Rado", "Raymond Weil",
      "Junghans", "Sinn", "Baume & Mercier", "Frederique Constant",
      "Bremont", "Doxa", "Squale", "Glycine", "Nomos", "Maurice Lacroix",
      "Montblanc", "Victorinox", "Ball", "Edox", "Alpina",
    ],
  },
  {
    label: "Microbrands",
    brands: [
      "Studio Underdog", "Christopher Ward", "Baltic", "Farer", "anOrdain", "Marloe",
      "Elliot Brown", "Pinion", "Lorier", "Furlan Marri", "Dan Henry",
    ],
  },
  {
    label: "Luxury",
    brands: [
      "Tudor", "Breitling", "Grand Seiko", "Cartier", "IWC", "Zenith", "Jaeger-LeCoultre", "Panerai",
      "Patek Philippe", "Audemars Piguet", "Vacheron Constantin", "Hublot", "Chopard",
      "Bell & Ross", "Blancpain", "Heuer",
    ],
  },
];

const ALL_BRANDS = [...POPULAR, ...MORE_GROUPS.flatMap((group) => group.brands)]
  // Longest first, so "Grand Seiko" wins over "Seiko"
  .sort((a, b) => b.length - a.length);

// Studio Underdog spells its name and models with a zero for the letter o
// ("Studio Underd0g", "Watermel0n"), and many sellers copy it
const ZERO_SPELT = /underd0g/g;

// The brand a title names, as spelt in the picker, or null
export function brandFromTitle(title) {
  const lower = ` ${String(title ?? "").toLowerCase().replace(ZERO_SPELT, "underdog").replace(/[^\p{L}\p{N}&-]+/gu, " ")} `;
  return ALL_BRANDS.find((brand) => lower.includes(` ${brand.toLowerCase()} `)) ?? null;
}

// Words in Studio Underdog searches that sellers may also spell with zeros
const UNDERDOG_WORDS = new Set([
  "watermelon", "desert", "mint", "choc", "chip", "goofy", "panda", "pink", "lemonade",
  "avocado", "guacamole", "pepperoni", "hawaiian", "pizza",
]);

// Every way of writing a word with some or all of its o's as zeros
function zeroSpellings(word) {
  const spots = [...word].flatMap((letter, index) => (letter === "o" ? [index] : []));
  const spellings = new Set([word]);
  for (const spot of spots) spellings.add(word.slice(0, spot) + "0" + word.slice(spot + 1));
  spellings.add(word.replace(/o/g, "0"));
  return [...spellings];
}

// The eBay search for some text. A Studio Underdog search also finds
// titles that spell the brand, and its model names, with zeros. eBay reads
// "(a, b)" as either word.
export function searchQuery(text) {
  const lower = String(text ?? "").toLowerCase().replace(ZERO_SPELT, "underdog");
  if (!/\bunderdog\b/.test(lower)) return text;
  return lower
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word === "underdog") return "(underdog, underd0g)";
      const spellings = UNDERDOG_WORDS.has(word) ? zeroSpellings(word) : [word];
      return spellings.length > 1 ? `(${spellings.join(", ")})` : word;
    })
    .join(" ");
}
