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
});
