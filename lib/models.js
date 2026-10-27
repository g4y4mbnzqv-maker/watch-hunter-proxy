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

// Finds the first model reference in a listing title, for example SKX007,
// SRPD55K1, 6139-6002, CA0695-84E or 2531.80. Returns it in upper case,
// or null.
export function extractModelRef(title) {
  if (!title) return null;

  const tokens = title.toUpperCase().match(/[A-Z0-9]+(?:[-/.][A-Z0-9]+)*/g) || [];

  for (const token of tokens) {
    if (token.length < 4 || token.length > 20) continue;
    if (!/\d/.test(token)) continue;

    const hasLetter = /[A-Z]/.test(token);
    // Pure numbers only count in the 6139-6002 or 2531.80 styles
    if (!hasLetter && !/^\d{4}[-.]\d{2,4}([-.]\d+)*$/.test(token)) continue;
    // A letter-and-digit reference needs at least two digits
    if (hasLetter && (token.match(/\d/g) || []).length < 2) continue;
    if (NOT_A_REF.some((pattern) => pattern.test(token))) continue;

    return token;
  }

  return null;
}

// True when two references describe the same model, so SRPD55 matches
// SRPD55K1 and SRPD55J1.
export function sameModel(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= 5 && longer.startsWith(shorter) && longer.length - shorter.length <= 2;
}

// Strips a two-character regional suffix (K1, J1, P1) from Seiko-style
// references so searches find every variant.
export function baseModel(ref) {
  return ref.replace(/^([A-Z]{3,4}\d{2,3})[A-Z]\d$/, "$1");
}
