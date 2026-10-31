"use client";

import { useCallback } from "react";
import { useStoredState } from "./hooks";
import { brandFromTitle } from "@/lib/brands";
import { TYPOS } from "@/lib/overlooked";

const today = () => new Date().toISOString().slice(0, 10);

// Single-brand scans don't tag listings with their brand
function guessBrand(item) {
  const fromTitle = brandFromTitle(item.title);
  if (fromTitle) return fromTitle;
  const misspelt = item.misspelt && Object.keys(TYPOS).find((brand) => TYPOS[brand].includes(item.misspelt));
  return misspelt ? brandFromTitle(misspelt) ?? misspelt : "";
}

// Your bought and sold watches, kept in this browser
export function useDeals() {
  const [deals, setDeals] = useStoredState("wh-deals", [], { sync: true });

  // From a listing you won or bought; returns the new deal's id
  const logPurchase = useCallback(
    (item) => {
      const id = `${Date.now()}-${item.itemId ?? "manual"}`;
      const deal = {
        id,
        itemId: item.itemId ?? null,
        title: item.title ?? "",
        brand: item.brand || guessBrand(item),
        url: item.url ?? "",
        image: item.image ?? "",
        boughtOn: today(),
        boughtFor: item.totalCost ?? "",
        // What the app's estimate rested on, to check it against the sale
        askingMedian: item.comps?.median ?? null,
        estimate: item.resale ?? null,
        soldOn: "",
        soldFor: "",
        fees: "",
        postageOut: "",
        platform: "ebay",
      };
      setDeals((current) => [deal, ...current]);
      return id;
    },
    [setDeals]
  );

  const updateDeal = useCallback(
    (id, changes) => setDeals((current) => current.map((deal) => (deal.id === id ? { ...deal, ...changes } : deal))),
    [setDeals]
  );

  const removeDeal = useCallback(
    (id) => setDeals((current) => current.filter((deal) => deal.id !== id)),
    [setDeals]
  );

  return { deals, logPurchase, updateDeal, removeDeal };
}
