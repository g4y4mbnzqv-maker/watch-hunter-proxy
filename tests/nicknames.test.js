import { describe, expect, it } from "vitest";
import { extractModelName } from "@/lib/nicknames";

describe("extractModelName", () => {
  it.each([
    ["Seiko Prospex Turtle automatic diver", "Seiko Turtle"],
    ["SEIKO KING TURTLE sapphire", "Seiko King Turtle"],
    ["G-Shock Royal Oak octagon black", "Casio Royal Oak"],
    ["Omega Speedmaster Professional Moonwatch", "Omega Moonwatch"],
    ["Rolex Sea Dweller 4000", "Rolex Sea-Dweller"],
    ["Tudor Black Bay 58 navy", "Tudor Black Bay"],
    ["Orient Bambino version 2 cream dial", "Orient Bambino"],
    ["Omega x Swatch MoonSwatch Mission to Mars", "Swatch MoonSwatch"],
  ])("names %s", (title, name) => {
    expect(extractModelName(title)).toBe(name);
  });

  it.each([
    "Audemars Piguet Royal Oak 15400",
    "Seiko automatic gents watch",
    "Ray-Ban sunglasses",
    "",
  ])("leaves %j alone", (title) => {
    expect(extractModelName(title)).toBeNull();
  });

  it("knows broad families, after the specific names", () => {
    expect(extractModelName("Omega Seamaster Quartz Watch")).toBe("Omega Seamaster");
    expect(extractModelName("Omega Seamaster 300 Master Co-Axial")).toBe("Omega Seamaster 300");
    expect(extractModelName("Omega Speedmaster Professional Moonwatch")).toBe("Omega Moonwatch");
    expect(extractModelName("Hamilton Khaki Navy Scuba")).toBe("Hamilton Khaki Navy");
    expect(extractModelName("Tissot PRC 200 Chronograph")).toBe("Tissot PRC 200");
  });

  it("knows models from more brands", () => {
    expect(extractModelName("Longines Flagship automatic 1970s")).toBe("Longines Flagship");
    expect(extractModelName("TAG Heuer Link Calibre 16")).toBe("TAG Heuer Link");
    expect(extractModelName("TAG Heuer Professional 200m diver")).toBe("TAG Heuer Professional");
    expect(extractModelName("TAG Heuer Aquaracer Professional 300m")).toBe("TAG Heuer Aquaracer");
    expect(extractModelName("Breitling Aerospace titanium")).toBe("Breitling Aerospace");
    expect(extractModelName("Tudor Prince Oysterdate 34mm")).toBe("Tudor Prince");
    expect(extractModelName("Oris Aquis Date 43.5mm")).toBe("Oris Aquis");
    expect(extractModelName("Bulova Devil Diver Oceanographer")).toBe("Bulova Oceanographer");
    expect(extractModelName("Christopher Ward C60 Trident Pro")).toBe("Christopher Ward C60 Trident");
  });
});
