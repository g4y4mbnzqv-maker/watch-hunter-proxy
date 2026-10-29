import { describe, expect, it } from "vitest";
import { MAX_TOP_BRANDS, addBrand, cleanTopBrands, moveBrand, removeBrand, toggleBrand } from "../app/client/topBrands";
import { POPULAR } from "@/lib/brands";

describe("Top deals brands", () => {
  it("adds a brand once, at the end or where it was dropped", () => {
    expect(addBrand(["Seiko", "Omega"], "Tudor")).toEqual(["Seiko", "Omega", "Tudor"]);
    expect(addBrand(["Seiko", "Omega"], "Tudor", 1)).toEqual(["Seiko", "Tudor", "Omega"]);
    const list = ["Seiko"];
    expect(addBrand(list, "seiko")).toBe(list);
  });

  it("stops at the limit", () => {
    const full = Array.from({ length: MAX_TOP_BRANDS }, (_, i) => `Brand ${i}`);
    expect(addBrand(full, "Tudor")).toBe(full);
  });

  it("removes a brand but never the last one", () => {
    expect(removeBrand(["Seiko", "Omega"], "omega")).toEqual(["Seiko"]);
    expect(removeBrand(["Seiko"], "Seiko")).toEqual(["Seiko"]);
  });

  it("toggles a brand in and out", () => {
    expect(toggleBrand(["Seiko"], "Omega")).toEqual(["Seiko", "Omega"]);
    expect(toggleBrand(["Seiko", "Omega"], "Omega")).toEqual(["Seiko"]);
  });

  it("moves a brand to where it was dropped", () => {
    expect(moveBrand(["A", "B", "C"], "C", 0)).toEqual(["C", "A", "B"]);
    expect(moveBrand(["A", "B", "C"], "A", 3)).toEqual(["B", "C", "A"]);
    expect(moveBrand(["A", "B", "C"], "A", 2)).toEqual(["B", "A", "C"]);
  });

  it("tidies what was stored", () => {
    expect(cleanTopBrands(["Seiko", " seiko ", "", 4, "Tudor"])).toEqual(["Seiko", "Tudor"]);
    expect(cleanTopBrands([])).toBe(POPULAR);
    expect(cleanTopBrands("nonsense")).toBe(POPULAR);
  });
});
