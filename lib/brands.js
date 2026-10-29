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

// The brand a title names, as spelt in the picker, or null
export function brandFromTitle(title) {
  const lower = ` ${String(title ?? "").toLowerCase().replace(/[^\p{L}\p{N}&-]+/gu, " ")} `;
  return ALL_BRANDS.find((brand) => lower.includes(` ${brand.toLowerCase()} `)) ?? null;
}
