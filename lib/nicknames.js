// Well-known model names and nicknames, used when a title has no reference
// number. Each family needs its brand (or an alias) in the title as well,
// so "Royal Oak" only means the Casio when the title says Casio or G-Shock.
// Longer phrases are checked first, so "King Turtle" wins over "Turtle".
const FAMILIES = [
  {
    brand: "Seiko",
    aliases: ["seiko"],
    names: [
      "King Turtle", "Mini Turtle", "Turtle", "Samurai", "Sumo", "Monster", "Baby Tuna", "Tuna",
      "Alpinist", "Cocktail Time", "Pogue", "Bullhead", "Captain Willard", "Willard", "Shogun",
      "Arnie", "Speedtimer",
    ],
  },
  {
    brand: "Casio",
    aliases: ["casio", "g-shock", "g shock"],
    names: ["Royal Oak", "CasiOak", "Full Metal", "Mudmaster", "Rangeman", "Frogman", "Gulfmaster", "Mudman"],
  },
  {
    brand: "Omega",
    aliases: ["omega"],
    names: [
      "Speedmaster Reduced", "Moonwatch", "Aqua Terra", "Planet Ocean", "Railmaster",
      "Seamaster 300", "Constellation", "De Ville",
    ],
  },
  {
    brand: "Rolex",
    aliases: ["rolex"],
    names: [
      "Sea-Dweller", "Submariner", "Datejust", "Day-Date", "Daytona", "GMT-Master", "Explorer",
      "Oyster Perpetual", "Air-King", "Yacht-Master", "Milgauss",
    ],
  },
  { brand: "Tudor", aliases: ["tudor"], names: ["Black Bay", "Pelagos", "Ranger"] },
  {
    brand: "Citizen",
    aliases: ["citizen"],
    names: ["Challenge Diver", "Bullhead", "Tsuno", "Fugu"],
  },
  {
    brand: "Orient",
    aliases: ["orient"],
    names: ["Kamasu", "Mako", "Ray", "Bambino", "Triton", "Kanno"],
  },
  { brand: "Tissot", aliases: ["tissot"], names: ["PRX", "Seastar", "Le Locle", "Gentleman", "Visodate"] },
  {
    brand: "Hamilton",
    aliases: ["hamilton"],
    names: ["Khaki Field", "Khaki Aviation", "Jazzmaster", "Ventura", "Intra-Matic", "Murph"],
  },
  { brand: "Swatch", aliases: ["swatch", "moonswatch"], names: ["MoonSwatch", "Fifty Fathoms"] },
  {
    brand: "Longines",
    aliases: ["longines"],
    names: ["HydroConquest", "Legend Diver", "Master Collection", "Spirit", "Conquest"],
  },
  { brand: "TAG Heuer", aliases: ["tag heuer", "tag"], names: ["Aquaracer", "Carrera", "Monaco", "Formula 1"] },
  {
    brand: "Breitling",
    aliases: ["breitling"],
    names: ["Navitimer", "Superocean", "Chronomat", "Avenger", "Colt"],
  },
  { brand: "Christopher Ward", aliases: ["christopher ward"], names: ["Trident", "Sealander", "Bel Canto"] },
  { brand: "Studio Underdog", aliases: ["studio underdog", "underdog"], names: ["Watermelon"] },
  { brand: "Baltic", aliases: ["baltic"], names: ["Aquascaphe", "Bicompax", "MR01"] },
  { brand: "Bulova", aliases: ["bulova"], names: ["Lunar Pilot", "Accutron", "Precisionist"] },
];

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
    if (match) return `${family.brand} ${match.name}`;
  }

  return null;
}
