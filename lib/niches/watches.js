// Watch Hunter: everything that makes the app about watches. The other apps
// have a file like this one with the same fields; lib/niche.js picks one.


// Strips a two-character regional suffix (K1, J1, P1) from Seiko-style
// references so searches find every variant
function seikoBase(ref) {
  return ref.replace(/^([A-Z]{3,4}\d{2,3})[A-Z]\d$/, "$1");
}

// Brands offered in the picker. POPULAR also drives Top deals and the
// daily price index harvest.
const POPULAR = ["Seiko", "Citizen", "Orient", "Casio", "Swatch", "Tissot", "Hamilton", "Omega", "Rolex"];

const MORE_GROUPS = [
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

// Common misspellings, by brand in lower case. Single words only, since they
// go into one eBay search as alternatives.
const TYPOS = {
  seiko: ["sieko", "seico", "seikio", "seikko"],
  citizen: ["citzen", "citizon", "citisen", "citazen"],
  orient: ["oreint", "orinet"],
  casio: ["cassio", "casoi"],
  swatch: ["swach", "swatsh"],
  tissot: ["tisot", "tissott", "tisott", "tissoit"],
  hamilton: ["hamiltion", "hamliton", "hamilon", "hamiliton"],
  omega: ["omgea", "omaga", "omeaga", "omefa"],
  rolex: ["rollex", "rolax", "rolx", "rolexx"],
  longines: ["longine", "longiness", "longenes", "logines"],
  breitling: ["brietling", "breitlin", "breiting", "brietlin"],
  tudor: ["tuder", "tudour"],
  oris: ["orris"],
  bulova: ["bolova", "bulowa"],
  junghans: ["junhans", "jungans"],
  certina: ["certinna", "certena"],
  "tag heuer": ["heur", "hauer", "huer", "tagheur"],
  heuer: ["heur", "hauer", "huer"],
  cartier: ["cartiar", "cartie"],
  zenith: ["zenit", "zentih"],
  panerai: ["panarai", "paneri", "paneria"],
  "christopher ward": ["cristopher", "christoper"],
};

// Well-known model names and nicknames, used when a title has no reference
// number. Each family needs its brand (or an alias) in the title as well,
// so "Royal Oak" only means the Casio when the title says Casio or G-Shock.
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

// Tokens that look like model references but describe size, depth or era
const NOT_A_REF = [
  /^\d+MM$/,
  /^\d+M$/,
  /^\d+ATM$/,
  /^\d+BAR$/,
  /^\d+J$/,
  /^\d+JEWELS?$/,
  /^\d{4}S$/,
  /^\d+CT$/,
  /^\d+K$/,
  /^\d+FT$/,
  /^\d+(ST|ND|RD|TH)$/,
];

// Titles matching any of these are parts, accessories or non-working watches
const JUNK_PATTERNS = [
  /\bfor parts\b/i,
  /\bparts only\b/i,
  /\bspares\b/i,
  /\brepairs?\b/i,
  /\bnot working\b/i,
  /\bnon[- ]?working\b/i,
  /\bbox only\b/i,
  /\bempty box\b/i,
  /\bstrap only\b/i,
  /\bwatch strap\b/i,
  /\breplacement strap\b/i,
  /\bbracelet only\b/i,
  /\bdial only\b/i,
  /\bmovement only\b/i,
  /\bcase only\b/i,
  /\bcrystal only\b/i,
  /\bbezel insert\b/i,
  /\bmanual only\b/i,
];

// Titles matching any of these are fakes or lookalikes of another brand's
// watch. They are always dropped, from auctions and from resale prices.
const REPLICA_PATTERNS = [
  /\bhomage\b/i,
  /\breplica\b/i,
  /\bfake\b/i,
  /\bcopy\b(?! of)/i,
  /\bclone\b/i,
  /\bnot genuine\b/i,
  /\bunbranded\b/i,
  /\b1:1\b/,
  /\bAAA\b/,
  // "Rolex style", "Submariner-inspired" and similar
  /\b(rolex|omega|cartier|patek|audemars|submariner|daytona|datejust|gmt|seamaster|speedmaster|nautilus|royal oak)[- ](style|inspired)\b/i,
];

// Phrases in a title that suggest the watch may not work as described or
// that the sale is hard to undo. Each has the short label shown on the card.
const CAUTION_PHRASES = [
  { pattern: /\buntested\b|\bnot tested\b/i, label: "untested" },
  { pattern: /\bunchecked\b/i, label: "unchecked" },
  { pattern: /\bsold as seen\b|\bas seen\b/i, label: "sold as seen" },
  { pattern: /\bas is\b/i, label: "as is" },
  { pattern: /\bno returns?\b/i, label: "no returns" },
  { pattern: /\bneeds? (a )?service\b|\bneeds? servicing\b/i, label: "needs a service" },
  { pattern: /\bneeds? attention\b|\bneeds? tlc\b|\bneeds? work\b/i, label: "needs work" },
  { pattern: /\b(running|runs) (slow|fast)\b|\b(loses|gains|losing|gaining) time\b/i, label: "keeps poor time" },
  { pattern: /\bstops\b|\bstopping\b|\bintermittent\b/i, label: "stops running" },
  { pattern: /\bunknown (working|condition)\b|\bworking\?/i, label: "working unknown" },
];

// Collaborations and limited runs often share a reference with the standard
// watch but sell for very different money
const SPECIAL_EDITION = /\bbamford\b|\blimited edition\b|\bltd\.? ed(ition)?\b|\bcollab(oration)?\b|\b1 of \d+/i;
// "Casio x Bamford" style collaborations: a capitalised name after the x,
// so measurements like "42 x 12mm" don't count
const COLLABORATION = /\s[xX×]\s+[A-Z][A-Za-z]/;

// Brands faked often enough that every listing deserves a closer look
const OFTEN_FAKED = [
  "Rolex", "Omega", "Cartier", "TAG Heuer", "Breitling", "Tudor", "Panerai", "IWC", "Hublot",
  "Audemars Piguet", "Patek Philippe", "Vacheron Constantin", "Zenith", "Jaeger-LeCoultre",
  "Chopard", "Bell & Ross", "Longines", "Grand Seiko",
];

// Words that say nothing about which watch it is
const FILLER_WORDS = /^(mens|men's|ladies|womens|women's|gents|vintage|rare|watch|wristwatch|automatic|quartz|new|used|boxed|genuine|original|stunning|superb|lovely|nice|great|wow)$/i;

export default {
  key: "watches",
  appName: "Watch Hunter",
  noun: { one: "watch", many: "watches" },
  description: "Find eBay UK watch auctions you can resell at a profit",
  heroTitle: "Find watches worth flipping",
  heroBody: "UK auctions and Buy It Now listings priced below what they resell for, after fees and postage.",
  searchPlaceholder: "Brand or model, such as Seiko SKX007",

  // eBay category every search is limited to, found through the Taxonomy API
  category: {
    query: "wristwatch",
    match: /^wrist ?watches$/i,
    // Backup check on each listing's own categories
    check: /watch/i,
  },

  popular: POPULAR,
  groups: MORE_GROUPS,
  typos: TYPOS,
  families: FAMILIES,

  refs: { notARef: NOT_A_REF, baseModel: seikoBase },

  junkPatterns: JUNK_PATTERNS,
  replicaPatterns: REPLICA_PATTERNS,
  cautionPhrases: CAUTION_PHRASES,
  isSpecialEdition: (title) => SPECIAL_EDITION.test(title || "") || COLLABORATION.test(title || ""),

  oftenFaked: OFTEN_FAKED,
  fakeAdvice: "ask for photos of the caseback, the movement and the serial, check the serial matches any papers",
  fillerWords: FILLER_WORDS,

  // Where to check prices by hand, as links only
  priceSites: (query) => [
    {
      name: "eBay sold listings",
      short: "Sold",
      url: `https://www.ebay.co.uk/sch/i.html?${new URLSearchParams({ _nkw: query, LH_Sold: "1", LH_Complete: "1" })}`,
    },
    {
      name: "Chrono24",
      short: "C24",
      url: `https://www.chrono24.co.uk/search/index.htm?${new URLSearchParams({ query, dosearch: "true" })}`,
    },
    {
      name: "Vinted",
      short: "Vinted",
      url: `https://www.vinted.co.uk/catalog?${new URLSearchParams({ search_text: query })}`,
    },
  ],
  roughCheck: "Chrono24",
  matchExplainer: "matched by reference or by well-known names like Turtle or Black Bay",
};
