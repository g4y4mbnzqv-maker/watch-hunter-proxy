// What a listing needs, shared by the browser and the server (lib/ebaySell.js)

// Photos per listing and largest file accepted
export const MAX_PHOTOS = 12;
export const MAX_PHOTO_BYTES = 12_000_000;

// Wristwatch conditions eBay UK accepts, as the Inventory API names them
export const CONDITIONS = [
  { key: "NEW", label: "New with box and papers" },
  { key: "NEW_OTHER", label: "New without box or papers" },
  { key: "NEW_WITH_DEFECTS", label: "New with imperfections" },
  { key: "SELLER_REFURBISHED", label: "Seller refurbished" },
  { key: "PRE_OWNED_EXCELLENT", label: "Pre-owned - Excellent" },
  { key: "USED_EXCELLENT", label: "Pre-owned - Good" },
  { key: "PRE_OWNED_FAIR", label: "Pre-owned - Fair" },
];
export const DEPARTMENTS = ["Men", "Women", "Unisex Adults"];

// Checks a listing before anything is sent to eBay; returns a message or null
export function listingProblem(input) {
  if (!input?.title?.trim()) return "Add a title";
  if (input.title.length > 80) return "Keep the title to 80 characters";
  if (!input.description?.trim()) return "Add a description";
  if (/\[[^\]]*\]/.test(input.description)) return "Fill in or remove the [brackets] in the description first";
  if (!input.brand?.trim()) return "Add the brand";
  if (!DEPARTMENTS.includes(input.department)) return "Choose men's, women's or unisex";
  if (!CONDITIONS.some((condition) => condition.key === input.condition)) return "Choose the condition";
  if (!(Number(input.price) > 0)) return "Set a price";
  if (!Array.isArray(input.photos) || !input.photos.length) return "Add at least one photo";
  if (input.photos.length > MAX_PHOTOS) return `Use up to ${MAX_PHOTOS} photos`;
  if (input.minOffer && Number(input.minOffer) >= Number(input.price)) return "The lowest offer must be under the price";
  return null;
}
