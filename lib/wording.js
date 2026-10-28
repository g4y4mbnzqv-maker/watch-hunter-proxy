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

// Returns the caution labels that apply to a listing title, in list order
export function cautionWords(title) {
  if (!title) return [];
  return CAUTION_PHRASES.filter(({ pattern }) => pattern.test(title)).map(
    ({ label }) => label
  );
}
