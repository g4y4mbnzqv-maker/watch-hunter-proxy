// Bike Hunter: whole bikes, road, gravel, mountain, hybrid, folding and
// e-bikes. Same fields as lib/niches/watches.js.

// Brands offered in the picker. POPULAR also drives Top deals and the
// daily price index harvest.
const POPULAR = ["Specialized", "Trek", "Cannondale", "Giant", "Canyon", "Boardman", "Brompton", "Santa Cruz", "Orbea"];

const MORE_GROUPS = [
  {
    label: "Road and gravel",
    brands: [
      "Cervelo", "Pinarello", "BMC", "Bianchi", "Ribble", "Cube", "Scott", "Colnago", "Wilier", "Look", "Factor",
      "Genesis", "Planet X", "Merida", "Focus", "Liv",
    ],
  },
  {
    label: "Mountain",
    brands: [
      "Yeti", "Whyte", "Orange", "Marin", "Nukeproof", "YT", "Commencal", "Transition", "Kona", "Lapierre", "Vitus",
      "GT", "Norco", "Ibis", "Pivot",
    ],
  },
  {
    label: "Hybrid, folding and city",
    brands: ["Tern", "Dahon", "Carrera", "Raleigh", "Dawes", "Pashley", "Claud Butler", "Elops"],
  },
  {
    label: "E-bikes",
    brands: ["Haibike", "Riese & Muller", "Gocycle", "VanMoof", "Cowboy", "Fuell", "Moustache"],
  },
];

// Common misspellings, by brand in lower case. Single words only, since they
// go into one eBay search as alternatives.
const TYPOS = {
  // Sellers in the UK often use the British spelling
  specialized: ["specialised", "specailized", "specalized", "specialzed"],
  cannondale: ["canondale", "cannondal", "cannodale", "canondal"],
  pinarello: ["pinerello", "pinarelo", "pinnarello"],
  boardman: ["bordman", "boardmann"],
  brompton: ["bromton", "brompon", "brompten"],
  "santa cruz": ["santacruz"],
  colnago: ["colnargo", "colnagno"],
  bianchi: ["bianci", "bianhi", "biancchi"],
  cervelo: ["cervello", "cerevelo"],
  canyon: ["canyion", "cannyon"],
  ribble: ["ribbel", "ribbble"],
  commencal: ["commencel", "comencal"],
  nukeproof: ["nukproof", "nuke-proof"],
  orbea: ["orbia", "obrea"],
};

// Model families. A bike's groupset changes its price a lot, so the name
// includes it where the title gives one: "Specialized Tarmac Ultegra".
const FAMILIES = [
  {
    brand: "Specialized",
    aliases: ["specialized", "specialised"],
    names: [
      "Allez Sprint", "Allez", "Tarmac", "Roubaix", "Diverge", "Aethos", "Crux", "Venge", "Rockhopper", "Stumpjumper",
      "Epic", "Enduro", "Status", "Sirrus", "Turbo Levo", "Turbo Vado", "Turbo Creo", "Turbo Como", "Chisel",
    ],
  },
  {
    brand: "Trek",
    aliases: ["trek"],
    names: ["Emonda", "Madone", "Domane", "Checkpoint", "Fuel EX", "Marlin", "Roscoe", "Slash", "Top Fuel", "Rail", "FX", "Allant"],
  },
  {
    brand: "Cannondale",
    aliases: ["cannondale"],
    names: [
      "SuperSix EVO", "SuperSix", "CAAD13", "CAAD12", "CAAD10", "CAAD Optimo", "Synapse", "Topstone", "SystemSix",
      "Scalpel", "Habit", "Jekyll", "Trail", "Quick",
    ],
  },
  {
    brand: "Giant",
    aliases: ["giant"],
    names: ["TCR", "Defy", "Propel", "Revolt", "Trance", "Reign", "Talon", "Escape", "Contend", "Anthem", "Stance"],
  },
  {
    brand: "Canyon",
    aliases: ["canyon"],
    names: ["Aeroad", "Ultimate", "Endurace", "Grail", "Grizl", "Spectral", "Neuron", "Strive", "Torque", "Lux", "Inflite", "Roadlite"],
  },
  { brand: "Boardman", aliases: ["boardman"], names: ["SLR", "ADV", "SLS", "MTX", "MHT", "HYB", "Team", "Elite"] },
  {
    brand: "Brompton",
    aliases: ["brompton"],
    names: ["Electric", "P Line", "T Line", "C Line", "A Line", "M6L", "M3L", "M2L", "S2L", "S6L", "H6L", "H3L", "P6R", "M6R"],
  },
  {
    brand: "Santa Cruz",
    aliases: ["santa cruz"],
    names: ["Hightower", "Bronson", "Nomad", "Megatower", "5010", "Tallboy", "Blur", "Heckler", "Stigmata", "Chameleon"],
  },
  { brand: "Orbea", aliases: ["orbea"], names: ["Orca", "Terra", "Oiz", "Occam", "Rise", "Rallon", "Avant", "Gain", "Alma"] },
  { brand: "Ribble", aliases: ["ribble"], names: ["Endurance SL", "Endurance", "CGR", "Ultra", "Gravel", "Hybrid AL"] },
  { brand: "Cube", aliases: ["cube"], names: ["Attain", "Agree", "Litening", "Stereo", "Reaction", "Nuroad", "Kathmandu", "Aim"] },
  { brand: "Pinarello", aliases: ["pinarello"], names: ["Dogma", "Prince", "Paris", "Razha", "Gan", "Grevil"] },
  { brand: "Bianchi", aliases: ["bianchi"], names: ["Oltre", "Specialissima", "Sprint", "Infinito", "Via Nirone", "Impulso", "Arcadex"] },
  { brand: "Scott", aliases: ["scott"], names: ["Addict", "Foil", "Speedster", "Spark", "Genius", "Scale", "Ransom", "Sub Cross"] },
  { brand: "Whyte", aliases: ["whyte"], names: ["T-160", "T-140", "T-130", "905", "909", "802", "S-150", "Glencoe"] },
  { brand: "Orange", aliases: ["orange"], names: ["Five", "Stage", "Clockwork", "Alpine", "Switch", "Crush", "P7"] },
  { brand: "Cervelo", aliases: ["cervelo", "cervélo"], names: ["S5", "R5", "R3", "Caledonia", "Soloist", "Aspero", "P5"] },
  { brand: "Colnago", aliases: ["colnago"], names: ["V3Rs", "V4Rs", "C64", "C68", "Master", "G3-X"] },
  { brand: "Marin", aliases: ["marin"], names: ["Rift Zone", "Alpine Trail", "San Quentin", "Hawk Hill", "Four Corners", "Nicasio"] },
  { brand: "Kona", aliases: ["kona"], names: ["Process", "Honzo", "Unit", "Sutra", "Rove", "Libre"] },
  { brand: "Tern", aliases: ["tern"], names: ["GSD", "HSD", "Vektron", "Verge", "Link"] },
];

// Groupsets, longest names first so "105 Di2" wins over "105"
const GROUPSETS = [
  "Dura-Ace Di2", "Dura-Ace", "Ultegra Di2", "Ultegra", "105 Di2", "105", "Tiagra", "Sora", "Claris",
  "Red AXS", "Force AXS", "Rival AXS", "Red", "Force", "Rival", "Apex", "GRX",
  "XTR", "Deore XT", "XT", "SLX", "Deore", "XX1", "X01", "GX Eagle", "GX", "NX", "SX",
];
const GROUPSET_PATTERNS = GROUPSETS.map((name) => ({
  name,
  pattern: new RegExp(`\\b${name.replace(/[-\s]+/g, "[-\\s]*")}\\b`, "i"),
}));

// The groupset a title names, or null
function groupset(title) {
  return GROUPSET_PATTERNS.find(({ pattern }) => pattern.test(title))?.name ?? null;
}

// Titles matching any of these are frames, parts, children's bikes or kit
const JUNK_PATTERNS = [
  /\bframe ?(only|set)\b/i,
  /\bframeset\b/i,
  /\bwheels? ?(only|set)\b/i,
  /\bwheelset\b/i,
  /\bfor parts\b/i,
  /\bparts only\b/i,
  /\bspares\b/i,
  /\brepairs?\b/i,
  /\bnon[- ]?runner\b/i,
  /\bgroupset only\b/i,
  /\bkids?\b|\bchild(ren)?'?s\b|\bjunior\b|\btoddler\b|\bbalance bike\b/i,
  /\b(12|14|16|20)("|”|''| ?inch| ?in)\s*(wheels?|bike)\b/i,
  /\bturbo trainer\b|\bsmart trainer\b|\bbike rack\b|\bhelmet\b|\bpedals only\b/i,
];

// Fakes and copies, always dropped
const REPLICA_PATTERNS = [/\breplica\b/i, /\bfake\b/i, /\bcopy\b(?! of)/i, /\bunbranded\b/i];

// Phrases that suggest trouble: stolen goods, hidden faults or a hasty sale
const CAUTION_PHRASES = [
  { pattern: /\bno frame number\b|\bframe number (removed|missing)\b/i, label: "no frame number" },
  { pattern: /\bquick sale\b|\bneed(s)? gone\b|\bmust go\b/i, label: "quick sale" },
  { pattern: /\bcash only\b/i, label: "cash only" },
  { pattern: /\bno questions\b|\bno time ?wasters\b/i, label: "no questions" },
  { pattern: /\bno receipt\b|\bno paperwork\b/i, label: "no receipt" },
  { pattern: /\bneeds? (a )?service\b|\bneeds? tlc\b|\bneeds? work\b|\bseized\b/i, label: "needs work" },
  { pattern: /\bcrack(ed|s)?\b|\bdamaged frame\b|\bcrash(ed)?\b/i, label: "cracked or crashed" },
  { pattern: /\bno charger\b|\bbattery (faulty|not holding|needs replacing|dead)\b/i, label: "battery or charger problem" },
  { pattern: /\buntested\b|\bsold as seen\b|\bas seen\b/i, label: "untested or sold as seen" },
  { pattern: /\bno returns?\b/i, label: "no returns" },
];

// Brands with counterfeit frames in circulation
const OFTEN_FAKED = ["Pinarello", "Colnago", "Specialized", "Cervelo", "Canyon", "Look"];

// Words that say nothing about which bike it is
const FILLER_WORDS = /^(mens|men's|ladies|womens|women's|road|bike|bicycle|cycle|mtb|mountain|gravel|hybrid|carbon|alloy|aluminium|frame|size|small|medium|large|new|used|great|nice|lovely|excellent|condition)$/i;

export default {
  key: "bikes",
  appName: "Bike Hunter",
  noun: { one: "bike", many: "bikes" },
  description: "Find eBay UK bikes you can resell at a profit",
  heroTitle: "Find bikes worth flipping",
  heroBody: "UK auctions and Buy It Now bikes priced below what they resell for, near you or posted.",
  searchPlaceholder: "Brand or model, such as Specialized Allez or Brompton M6L",

  category: {
    // Searched as a road bike, then eBay's Bikes category taken from its parents
    query: "road bike",
    match: /^bikes$/i,
    check: /bike|cycl/i,
  },

  popular: POPULAR,
  groups: MORE_GROUPS,
  typos: TYPOS,
  families: FAMILIES,
  // "Specialized Tarmac" becomes "Specialized Tarmac Ultegra" when the
  // title names a groupset
  nameSuffix: groupset,

  // Bike titles are full of part numbers that aren't the bike's model, so
  // bikes are matched by model name alone
  refs: { enabled: false, notARef: [], baseModel: null },

  junkPatterns: JUNK_PATTERNS,
  replicaPatterns: REPLICA_PATTERNS,
  cautionPhrases: CAUTION_PHRASES,
  isSpecialEdition: (title) => /\blimited edition\b|\bteam edition\b|\b1 of \d+/i.test(title || ""),

  oftenFaked: OFTEN_FAKED,
  fakeAdvice: "ask for close photos of the frame, the head badge and the frame number, check the frame number on BikeRegister",
  // Shown on every bike, because theft is the biggest risk
  everyListingNote:
    "Ask for the frame number (usually under the bottom bracket) and check it on bikeregister.com before paying. Walk away if the seller won't give it. Collecting? Meet at the seller's home, not a car park.",
  fillerWords: FILLER_WORDS,

  // Most bikes are collection only, so scans can be limited to a distance
  // from your postcode (set in Settings)
  collection: true,

  priceSites: (query) => [
    {
      name: "eBay sold listings",
      short: "Sold",
      url: `https://www.ebay.co.uk/sch/i.html?${new URLSearchParams({ _nkw: query, LH_Sold: "1", LH_Complete: "1" })}`,
    },
    {
      name: "Facebook Marketplace",
      short: "FB",
      url: `https://www.facebook.com/marketplace/search/?${new URLSearchParams({ query })}`,
    },
    {
      name: "Gumtree",
      short: "Gumtree",
      url: `https://www.gumtree.com/search?${new URLSearchParams({ search_category: "bicycles", q: query })}`,
    },
  ],
  roughCheck: "eBay sold listings and Facebook Marketplace",
  matchExplainer:
    "matched by model and groupset, such as Specialized Tarmac Ultegra. Frame size and year aren't compared, so check them",
  // Bikes are usually collected, so no postage to your buyer by default
  settings: { postageOut: 0 },
};
