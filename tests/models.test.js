import { describe, expect, it } from "vitest";
import { baseModel, extractModelRef, sameModel } from "@/lib/models";

describe("extractModelRef", () => {
  it.each([
    ["Seiko SKX007 Automatic Divers 200m Watch 42mm", "SKX007"],
    ["Vintage Seiko 6139-6002 Pogue Chronograph 1970s", "6139-6002"],
    ["Seiko 5 Sports SRPD55K1 Automatic", "SRPD55K1"],
    ["Citizen Eco-Drive CA0695-84E Chronograph", "CA0695-84E"],
    ["Omega Seamaster 300M 2531.80", "2531.80"],
    ["Casio G-Shock DW-5600E-1VER", "DW-5600E-1VER"],
  ])("finds the reference in %s", (title, ref) => {
    expect(extractModelRef(title)).toBe(ref);
  });

  it.each([
    "Mens Seiko 21 jewels automatic watch 37mm",
    "Rolex Submariner 200m 40mm 1970s",
    "",
  ])("ignores sizes, depths and years in %j", (title) => {
    expect(extractModelRef(title)).toBeNull();
  });
});

describe("sameModel and baseModel", () => {
  it("groups regional variants together", () => {
    expect(baseModel("SRPD55K1")).toBe("SRPD55");
    expect(sameModel("SRPD55", "SRPD55J1")).toBe(true);
    expect(sameModel("SKX007", "SKX007")).toBe(true);
  });

  it("keeps different models apart", () => {
    expect(sameModel("SKX007", "SKX009")).toBe(false);
    expect(baseModel("CA0695-84E")).toBe("CA0695-84E");
  });
});
