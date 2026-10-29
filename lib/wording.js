import { niche } from "./niche";

// Phrases in a title that suggest the item may not be as described or that
// the sale is hard to undo, from the app's niche file
const CAUTION_PHRASES = niche.cautionPhrases;

// Collaborations and limited runs often share a model with the standard
// version but sell for very different money
export function isSpecialEdition(title) {
  return niche.isSpecialEdition(title);
}

// Returns the caution labels that apply to a listing title, in list order
export function cautionWords(title) {
  if (!title) return [];
  return CAUTION_PHRASES.filter(({ pattern }) => pattern.test(title)).map(
    ({ label }) => label
  );
}
