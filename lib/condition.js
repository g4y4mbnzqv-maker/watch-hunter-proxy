// Condition grades the app filters on, best first
export const GRADES = [
  { key: "new", label: "New" },
  { key: "excellent", label: "Excellent" },
  { key: "good", label: "Good" },
  { key: "fair", label: "Fair" },
  { key: "ungraded", label: "Not graded" },
];

// eBay condition IDs that carry a grade of their own. Plain "Pre-owned"
// (3000) is missing on purpose: in many categories it says nothing about
// how good the watch is.
const GRADE_BY_ID = {
  1000: "new", // New, or New with tags
  1500: "new", // New without tags, or Open box
  1750: "fair", // New with defects
  2000: "good", // Certified refurbished
  2010: "excellent", // Excellent refurbished
  2020: "good", // Very good refurbished
  2030: "good", // Good refurbished
  2500: "good", // Seller refurbished
  2750: "excellent", // Like new
  2990: "excellent", // Pre-owned: Excellent
  3010: "fair", // Pre-owned: Fair
  4000: "good", // Very good
  5000: "good", // Good
  6000: "fair", // Acceptable
};

const CONDITION_TEXT = [
  { pattern: /excellent|like new|mint/i, grade: "excellent" },
  { pattern: /fair|acceptable/i, grade: "fair" },
  { pattern: /good/i, grade: "good" },
];

// Wording sellers use in titles when eBay's condition says only "Pre-owned"
const TITLE_WORDING = [
  { pattern: /\b(mint|near mint|immaculate|excellent condition|excellent|as new|like new)\b/i, grade: "excellent" },
  { pattern: /\b(very good|good condition|great condition)\b/i, grade: "good" },
];

// Works out a listing's grade. Returns { grade, from } where from is
// "ebay" when eBay's condition gave it, "title" when the title did, or
// null for ungraded listings.
export function conditionGrade({ conditionId, condition, title }) {
  const byId = GRADE_BY_ID[parseInt(conditionId, 10)];
  if (byId) return { grade: byId, from: "ebay" };

  const byText = CONDITION_TEXT.find(({ pattern }) => pattern.test(condition || ""));
  if (byText) return { grade: byText.grade, from: "ebay" };

  const id = parseInt(conditionId, 10);
  if (id >= 1000 && id < 2000) return { grade: "new", from: "ebay" };

  const byTitle = TITLE_WORDING.find(({ pattern }) => pattern.test(title || ""));
  if (byTitle) return { grade: byTitle.grade, from: "title" };

  return { grade: "ungraded", from: null };
}

export function gradeLabel(grade) {
  return GRADES.find((option) => option.key === grade)?.label ?? grade;
}
