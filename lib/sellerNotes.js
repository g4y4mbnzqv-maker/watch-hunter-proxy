// Your own marks on sellers: "trust" after a good purchase, "avoid" after a
// bad one. Kept as { [username]: { mark, at } } and synced like settings.

export const SELLER_MARKS = ["trust", "avoid"];

// The mark you gave a listing's seller, or null
export function sellerMark(notes, seller) {
  const name = seller?.username;
  if (!name || !notes || typeof notes !== "object") return null;
  const mark = notes[name.toLowerCase()]?.mark;
  return SELLER_MARKS.includes(mark) ? mark : null;
}

// notes with a seller's mark set, changed or (with null) cleared
export function withSellerMark(notes, username, mark, now = Date.now()) {
  const next = { ...(notes && typeof notes === "object" ? notes : {}) };
  const key = String(username ?? "").toLowerCase();
  if (!key) return next;
  if (mark && SELLER_MARKS.includes(mark)) next[key] = { mark, at: now };
  else delete next[key];
  return next;
}
