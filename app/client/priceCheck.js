"use client";

import { extractModelRef, modelKey } from "@/lib/models";
import { extractModelName } from "@/lib/nicknames";

// The model a title names, the same way scans group listings
export function titleModelKey(title) {
  const modelRef = extractModelRef(title);
  return modelKey({ modelRef, modelName: modelRef ? null : extractModelName(title) });
}

// Today's asking prices for each title, in order: stats or null each
export async function fetchPrices(titles) {
  const res = await fetch("/api/comps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ titles }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.message || `Price check failed (${res.status})`);
  return data.prices;
}
