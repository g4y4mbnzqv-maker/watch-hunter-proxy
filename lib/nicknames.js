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
      "Arnie", "Speedtimer", "5 Sports",
    ],
  },
  {
    brand: "Casio",
    aliases: ["casio", "g-shock", "g shock"],
    names: ["Royal Oak", "CasiOak", "Full Metal", "Mudmaster", "Rangeman", "Frogman", "Gulfmaster", "Mudman", "Edifice"],
  },
  {
    brand: "Omega",
    aliases: ["omega"],
    names: [
      "Speedmaster Reduced", "Moonwatch", "Aqua Terra", "Planet Ocean", "Railmaster",
      "Seamaster 300", "Constellation", "De Ville",
    ],
    // Broad families, checked only when no specific name matches; their
    // wide price ranges usually make the estimate rough
    broad: ["Seamaster", "Speedmaster", "Geneve"],
  },
  {
    brand: "Rolex",
    aliases: ["rolex"],
    names: [
      "Sea-Dweller", "Submariner", "Datejust", "Day-Date", "Daytona", "GMT-Master", "Explorer",
      "Oyster Perpetual", "Air-King", "Yacht-Master", "Milgauss", "Oysterdate",
    ],
  },
  {
    brand: "Tudor",
    aliases: ["tudor"],
    names: ["Black Bay", "Pelagos", "Ranger", "Prince", "Heritage Chrono", "Glamour", "Fastrider", "Advisor", "North Flag", "Royal"],
    broad: ["Oysterdate"],
  },
  {
    brand: "Citizen",
    aliases: ["citizen"],
    names: ["Challenge Diver", "Bullhead", "Tsuno", "Fugu", "Promaster"],
  },
  {
    brand: "Orient",
    aliases: ["orient"],
    names: ["Kamasu", "Mako", "Ray", "Bambino", "Triton", "Kanno"],
  },
  { brand: "Tissot", aliases: ["tissot"], names: ["PRX", "Seastar", "Le Locle", "Gentleman", "Visodate", "PRC 200", "PR 100", "T-Touch", "T-Race", "Sideral", "Stylist"] },
  {
    brand: "Hamilton",
    aliases: ["hamilton"],
    names: ["Khaki Field", "Khaki Aviation", "Khaki Navy", "Khaki King", "Jazzmaster", "Ventura", "Intra-Matic", "Murph", "Pan Europ"],
  },
  { brand: "Swatch", aliases: ["swatch", "moonswatch"], names: ["MoonSwatch", "Fifty Fathoms", "Irony"] },
  {
    brand: "Longines",
    aliases: ["longines"],
    names: [
      "HydroConquest", "Legend Diver", "Master Collection", "Spirit", "Conquest", "Flagship", "DolceVita",
      "Admiral", "Evidenza", "La Grande Classique", "PrimaLuna", "Ultra-Chron", "Heritage",
    ],
  },
  {
    brand: "TAG Heuer",
    aliases: ["tag heuer", "tag"],
    names: ["Aquaracer", "Carrera", "Monaco", "Formula 1", "Link", "Autavia", "Kirium", "Monza"],
    broad: ["Professional"],
  },
  {
    brand: "Breitling",
    aliases: ["breitling"],
    names: [
      "Navitimer", "Superocean", "Chronomat", "Avenger", "Colt", "Premier", "Aerospace", "Emergency",
      "Top Time", "Transocean", "Montbrillant", "Galactic", "Crosswind",
    ],
  },
  { brand: "Christopher Ward", aliases: ["christopher ward"], names: ["Trident", "Sealander", "Bel Canto", "C60 Trident", "C65 Trident", "C63 Sealander"] },
  {
    brand: "Studio Underdog",
    aliases: ["studio underdog", "underdog"],
    names: [
      "Watermelon", "Desert Sky", "Mint Choc Chip", "Goofy Panda", "Pink Lemonade",
      "Avocado", "Guacamole", "Pepperoni", "Hawaiian",
    ],
  },
  { brand: "Baltic", aliases: ["baltic"], names: ["Aquascaphe", "Bicompax", "MR01"] },
  {
    brand: "Bulova",
    aliases: ["bulova"],
    names: ["Lunar Pilot", "Accutron", "Precisionist", "Marine Star", "Oceanographer", "Archive"],
  },
  {
    brand: "Oris",
    aliases: ["oris"],
    names: ["Aquis", "Big Crown", "Divers Sixty-Five", "ProPilot", "Artix", "Artelier", "TT1"],
  },
];

// Turns "Sea-Dweller" into a pattern that also matches "Sea Dweller", and
// lets any o be a zero, since some brands spell names that way ("Watermel0n")
function phrasePattern(phrase) {
  const words = phrase
    .split(/[\s-]+/)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/o/gi, "[o0]"));
  return new RegExp(`\\b${words.join("[\\s-]*")}\\b`, "i");
}

const MATCHERS = FAMILIES.map((family) => ({
  brand: family.brand,
  aliases: family.aliases.map(phrasePattern),
  names: [
    ...[...family.names].sort((a, b) => b.length - a.length),
    ...[...(family.broad ?? [])].sort((a, b) => b.length - a.length),
  ].map((name) => ({ name, pattern: phrasePattern(name) })),
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
