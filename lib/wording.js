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

export function isSpecialEdition(title) {
  return SPECIAL_EDITION.test(title || "") || COLLABORATION.test(title || "");
}

// Returns the caution labels that apply to a listing title, in list order
export function cautionWords(title) {
  if (!title) return [];
  return CAUTION_PHRASES.filter(({ pattern }) => pattern.test(title)).map(
    ({ label }) => label
  );
}
