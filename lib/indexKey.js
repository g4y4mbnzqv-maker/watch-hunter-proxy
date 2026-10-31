import { baseModel } from "./models";

// The model a listing belongs to in the index, matching how its resale
// estimate was looked up
export function indexModel(item) {
  if (item.modelRef) {
    const base = baseModel(item.modelRef);
    return { key: `ref:${base}`, label: base };
  }
  if (item.modelName) return { key: `name:${item.modelName}`, label: item.modelName };
  return null;
}

// The 30-day price change for a listing's model from the price index, in
// the listing's condition where tracked, else any condition. Returns
// { percent, since } or null. trends is { [modelKey]: { [condition]: change } }.
export function trendFor(item, trends) {
  const model = indexModel(item);
  const byCondition = model && trends?.[model.key];
  if (!byCondition) return null;
  return byCondition[item.conditionGroup ?? "ANY"] ?? byCondition.ANY ?? Object.values(byCondition)[0] ?? null;
}

// Turns the price index list into lookups for trendFor
export function trendMap(models) {
  const trends = {};
  for (const model of models ?? []) {
    if (!model.change) continue;
    (trends[model.modelKey] ??= {})[model.condition] = model.change;
  }
  return trends;
}
