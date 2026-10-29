// Clothes Hunter: trainers, outdoor jackets and designer clothing. Same
// fields as lib/niches/watches.js.

// Brands offered in the picker. POPULAR also drives Top deals and the
// daily price index harvest.
const POPULAR = [
  "Nike", "Adidas", "New Balance", "Salomon", "Stone Island", "CP Company", "Barbour", "The North Face", "Arc'teryx",
];

const MORE_GROUPS = [
  {
    label: "Trainers",
    brands: ["Asics", "Hoka", "On", "Vans", "Converse", "Puma", "Reebok", "Onitsuka Tiger", "Jordan", "Saucony"],
  },
  {
    label: "Outdoor",
    brands: [
      "Patagonia", "Rab", "Montane", "Mountain Equipment", "Berghaus", "Fjallraven", "Columbia", "Haglofs",
      "Canada Goose", "Moncler",
    ],
  },
  {
    label: "Designer and casual",
    brands: [
      "Ralph Lauren", "Burberry", "Belstaff", "Paul Smith", "Hugo Boss", "Lacoste", "Fred Perry", "Ma.Strum",
      "Moose Knuckles", "Represent",
    ],
  },
  {
    label: "Workwear and vintage",
    brands: ["Carhartt", "Levi's", "Dickies", "Stussy", "Supreme", "Palace", "Dr. Martens", "Red Wing"],
  },
];

// Common misspellings, by brand in lower case. Single words only, since they
// go into one eBay search as alternatives.
const TYPOS = {
  adidas: ["addidas", "adiddas", "addias", "adidias"],
  nike: ["nikey", "nkie"],
  "new balance": ["newbalance", "ballance"],
  salomon: ["solomon", "salamon"],
  "stone island": ["stoneisland", "stoneislands"],
  "cp company": ["cpcompany", "c.p.company"],
  barbour: ["barbor", "barbours"],
  "the north face": ["northface", "nothface"],
  "arc'teryx": ["arcteryx", "arcterix", "arcteyrx", "arcterx"],
  patagonia: ["patigonia", "patagoina", "patagona"],
  moncler: ["monclear", "monlcer", "monckler"],
  "canada goose": ["canadagoose"],
  carhartt: ["carhart", "carharrt", "carhatt"],
  "ralph lauren": ["lauran", "laurens"],
  fjallraven: ["fjallravan", "fjalraven", "fjällräven"],
  belstaff: ["belstaf", "bellstaff"],
};

// Well-known model names. Each family needs its brand (or an alias) in the
// title as well, so "Ghost" only counts for Stone Island.
const FAMILIES = [
  {
    brand: "Nike",
    aliases: ["nike"],
    names: [
      "Dunk Low", "Dunk High", "Air Force 1", "Air Max 90", "Air Max 95", "Air Max 97", "Air Max 1", "Air Max Plus",
      "Vomero 5", "P-6000", "Cortez", "Blazer Mid", "Shox TL", "Air Jordan 1", "Air Jordan 4", "Air Jordan 3",
    ],
  },
  { brand: "Jordan", aliases: ["jordan"], names: ["Jordan 1 High", "Jordan 1 Low", "Jordan 4", "Jordan 3", "Jordan 11"] },
  {
    brand: "Adidas",
    aliases: ["adidas"],
    names: ["Samba", "Gazelle", "Spezial", "Campus 00s", "Campus", "Superstar", "Stan Smith", "Yeezy 350", "Forum", "SL 72", "Taekwondo"],
  },
  {
    brand: "New Balance",
    aliases: ["new balance", "nb"],
    names: ["990v6", "990v5", "990v4", "990v3", "991", "992", "993", "2002R", "1906R", "9060", "550", "574", "327", "530", "1000"],
  },
  { brand: "Salomon", aliases: ["salomon"], names: ["XT-6", "XT-4", "XT-Whisper", "ACS Pro", "Speedcross", "XA Pro 3D"] },
  { brand: "Asics", aliases: ["asics"], names: ["Gel-Kayano 14", "Gel-1130", "GT-2160", "Gel-NYC", "Gel-Lyte III", "Gel-Lyte V"] },
  { brand: "Hoka", aliases: ["hoka"], names: ["Clifton", "Bondi", "Speedgoat", "Mafate Speed", "Tor Ultra"] },
  { brand: "On", aliases: ["on running", "on cloud"], names: ["Cloudmonster", "Cloudtilt", "Cloud 5", "Cloudnova"] },
  {
    brand: "The North Face",
    aliases: ["north face", "tnf"],
    names: ["1996 Retro Nuptse", "Nuptse", "Himalayan", "Mountain Jacket", "Denali", "Steep Tech", "Mountain Light", "Summit"],
  },
  {
    brand: "Barbour",
    aliases: ["barbour"],
    names: ["Bedale", "Beaufort", "Border", "Ashby", "Transport", "International", "Duke", "Spey", "Liddesdale"],
  },
  {
    brand: "Patagonia",
    aliases: ["patagonia"],
    names: ["Retro-X", "Retro Pile", "Synchilla", "Torrentshell", "Nano Puff", "Down Sweater", "Houdini", "Better Sweater", "Classic Retro-X"],
  },
  {
    brand: "Arc'teryx",
    aliases: ["arc'teryx", "arcteryx", "arc teryx"],
    names: ["Beta LT", "Beta AR", "Beta SL", "Alpha SV", "Alpha AR", "Atom LT", "Atom SL", "Atom", "Gamma", "Cerium", "Zeta SL", "Squamish"],
  },
  {
    brand: "Stone Island",
    aliases: ["stone island"],
    names: ["Ghost Piece", "Shadow Project", "Soft Shell-R", "Crinkle Reps", "Membrana", "Nylon Metal", "Garment Dyed", "Overshirt"],
  },
  { brand: "CP Company", aliases: ["cp company", "c.p. company", "c.p company"], names: ["Goggle Jacket", "Mille Miglia", "Chrome-R", "Nycra", "Lens"] },
  { brand: "Moncler", aliases: ["moncler"], names: ["Maya", "Montclar", "Montgenevre", "Vezere", "Grenoble"] },
  { brand: "Canada Goose", aliases: ["canada goose"], names: ["Expedition", "Chilliwack", "Wyndham", "Langford", "Crofton", "Freestyle", "Lodge"] },
  { brand: "Carhartt", aliases: ["carhartt"], names: ["Detroit Jacket", "Active Jacket", "Michigan", "Chore Coat", "Double Knee"] },
  { brand: "Levi's", aliases: ["levi's", "levis", "levi"], names: ["501", "505", "Big E", "Type 3", "Trucker"] },
];

// Tokens that look like style codes but are sizes, seasons or measurements
const NOT_A_REF = [
  /^UK\d+(\.5)?$/,
  /^EU\d+(\.5)?$/,
  /^US\d+(\.5)?$/,
  /^W\d+(L\d+)?$/,
  /^L\d+$/,
  /^\d+W$/,
  /^\d+L$/,
  /^\d+CM$/,
  /^\d+MM$/,
  /^\d+(XL|XS)$/,
  /^(AW|SS|FW)\d{2,4}$/,
  /^\d{2,4}S$/,
  /^\d+(ST|ND|RD|TH)$/,
];

// Titles matching any of these are empty boxes, parts or accessories
const JUNK_PATTERNS = [
  /\bbox only\b/i,
  /\bempty box\b/i,
  /\blaces only\b/i,
  /\binsoles? only\b/i,
  /\bbadge only\b/i,
  /\bpatch only\b/i,
  /\btags? only\b/i,
  /\bhood only\b/i,
  /\bfor parts\b/i,
  /\bspares\b/i,
  /\bdust bag only\b/i,
  /\bcleaning kit\b/i,
];

// Fakes and lookalikes, always dropped
const REPLICA_PATTERNS = [
  /\breplica\b/i,
  /\bfake\b/i,
  /\binspired\b/i,
  /\bdupe\b/i,
  /\bnot genuine\b/i,
  /\bunbranded\b/i,
  /\bmirror quality\b/i,
  /\b1:1\b/,
  /\bAAA\b/,
  /\b(stone island|moncler|nike|yeezy|jordan|canada goose)[- ](style|look)\b/i,
];

// Phrases that suggest the item isn't as good as it looks, or that the sale
// is hard to undo
const CAUTION_PHRASES = [
  { pattern: /\bbeaters?\b/i, label: "beaters" },
  { pattern: /\bheavily worn\b|\bwell worn\b|\bworn out\b/i, label: "well worn" },
  { pattern: /\bcreas(ed|ing)\b/i, label: "creased" },
  { pattern: /\bstain(s|ed)?\b/i, label: "stains" },
  { pattern: /\bholes?\b|\btears?\b|\bripped\b/i, label: "holes or tears" },
  { pattern: /\bsole (separation|coming away)\b|\bresoled\b/i, label: "sole problems" },
  { pattern: /\bno box\b/i, label: "no box" },
  { pattern: /\bsold as seen\b|\bas seen\b/i, label: "sold as seen" },
  { pattern: /\bno returns?\b/i, label: "no returns" },
  { pattern: /\bunsure of authenticity\b|\bauthenticity unknown\b|\bnot sure if (genuine|real)\b/i, label: "may not be genuine" },
];

// Collaborations and limited drops sell for very different money from the
// standard version
const SPECIAL_EDITION = /\blimited edition\b|\bcollab(oration)?\b|\btravis scott\b|\boff[- ]white\b|\bsupreme\b|\bsample\b|\b1 of \d+/i;
const COLLABORATION = /\s[xX×]\s+[A-Z][A-Za-z]/;

// Brands faked often enough that every listing deserves a closer look
const OFTEN_FAKED = [
  "Nike", "Jordan", "Adidas", "Stone Island", "CP Company", "Moncler", "Canada Goose", "Arc'teryx", "The North Face",
  "Burberry", "Supreme", "Ralph Lauren", "Moose Knuckles",
];

// Words that say nothing about which model it is
const FILLER_WORDS = /^(mens|men's|ladies|womens|women's|vintage|rare|new|used|boxed|genuine|original|authentic|size|uk|jacket|coat|trainers|shoes|sneakers|hoodie|top|great|nice|wow)$/i;

export default {
  key: "clothes",
  appName: "Clothes Hunter",
  noun: { one: "item", many: "items" },
  description: "Find eBay UK clothes and trainers you can resell at a profit",
  heroTitle: "Find clothes and trainers worth flipping",
  heroBody: "UK auctions and Buy It Now listings priced below what they resell for, after fees and postage.",
  searchPlaceholder: "Brand or model, such as Barbour Bedale or DD1391-100",

  category: {
    // Searched as a men's jacket, then the top-level category taken from its parents
    query: "mens jacket",
    match: /^clothes, shoes (&|and) accessories$/i,
    check: /clothes|clothing|shoes|trainers|footwear|coats|jackets|tops|jeans|knitwear|hoodies|sweats/i,
  },

  popular: POPULAR,
  groups: MORE_GROUPS,
  typos: TYPOS,
  families: FAMILIES,

  // Trainer style codes, such as DD1391-100, are compared exactly
  refs: { notARef: NOT_A_REF, baseModel: null },

  junkPatterns: JUNK_PATTERNS,
  replicaPatterns: REPLICA_PATTERNS,
  cautionPhrases: CAUTION_PHRASES,
  isSpecialEdition: (title) => SPECIAL_EDITION.test(title || "") || COLLABORATION.test(title || ""),

  oftenFaked: OFTEN_FAKED,
  fakeAdvice:
    "ask for photos of the inside size label with its style code, the box label, the care labels and the stitching, check the style codes match",
  fillerWords: FILLER_WORDS,

  priceSites: (query) => [
    {
      name: "eBay sold listings",
      short: "Sold",
      url: `https://www.ebay.co.uk/sch/i.html?${new URLSearchParams({ _nkw: query, LH_Sold: "1", LH_Complete: "1" })}`,
    },
    {
      name: "Vinted",
      short: "Vinted",
      url: `https://www.vinted.co.uk/catalog?${new URLSearchParams({ search_text: query })}`,
    },
    {
      name: "Depop",
      short: "Depop",
      url: `https://www.depop.com/search/?${new URLSearchParams({ q: query })}`,
    },
  ],
  roughCheck: "Vinted and eBay sold listings",
  matchExplainer: "matched by style code or by well-known names like Bedale, Nuptse or Samba. Sizes aren't compared, so check yours sells",
};
