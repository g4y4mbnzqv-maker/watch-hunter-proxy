import { brandFromTitle } from "./brands";
import { getComparables } from "./ebay";
import { extractModelRef } from "./models";
import { extractModelName } from "./nicknames";

// Current asking prices for watches you own, by title: for pricing a sale
// and valuing stock. Uses the same lookups as scans, shared through the
// database, so a watch checked recently costs no eBay calls.

// Titles per request
export const MAX_TITLES = 20;

// Returns one entry per title: the comparables stats for a pre-owned one,
// or null when the title has no model to look up or too few listings match
export async function checkPrices(titles) {
  const items = titles.slice(0, MAX_TITLES).map((title, index) => {
    const modelRef = extractModelRef(title);
    return {
      itemId: String(index),
      title,
      brand: brandFromTitle(title) ?? "",
      modelRef,
      modelName: modelRef ? null : extractModelName(title),
      conditionGroup: "USED",
    };
  });

  const byBrand = {};
  for (const item of items) (byBrand[item.brand] ??= []).push(item);
  const results = {};
  for (const [brand, list] of Object.entries(byBrand)) {
    Object.assign(results, await getComparables(brand, list));
  }
  return items.map((item) => results[item.itemId] ?? null);
}
