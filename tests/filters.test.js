import { describe, expect, it } from "vitest";
import { isJunk, isReplica } from "@/lib/ebay";
import { cautionWords } from "@/lib/wording";

describe("isReplica", () => {
  it.each([
    "Rolex Submariner homage automatic",
    "Submariner-style dive watch 40mm",
    "Rolex Datejust AAA 1:1 clone",
    "Steinhart Ocean One GMT-inspired",
  ])("drops %s", (title) => {
    expect(isReplica(title)).toBe(true);
  });

  it.each([
    "Seiko SKX007 diver",
    "Seiko 5 Sports diver style",
    "Omega Seamaster with copy of receipt",
    "Christopher Ward C65 vintage inspired diver",
  ])("keeps %s", (title) => {
    expect(isReplica(title)).toBe(false);
  });
});

describe("isJunk", () => {
  it("drops parts and accessories but keeps watches on straps", () => {
    expect(isJunk("Seiko 7S26 movement only for parts")).toBe(true);
    expect(isJunk("Genuine Seiko watch strap 22mm")).toBe(true);
    expect(isJunk("Seiko SKX007 diver on leather strap")).toBe(false);
  });
});

describe("cautionWords", () => {
  it("picks out risky wording", () => {
    expect(cautionWords("Seiko 6139 untested sold as seen")).toEqual(["untested", "sold as seen"]);
    expect(cautionWords("Citizen needs service, losing time")).toEqual(["needs a service", "keeps poor time"]);
    expect(cautionWords("Rolex Oyster working?")).toEqual(["working unknown"]);
  });

  it("leaves clean titles alone", () => {
    expect(cautionWords("Seiko SKX007 serviced 2024, runs perfectly")).toEqual([]);
    expect(cautionWords("Seiko 5 runs well, returns accepted")).toEqual([]);
  });
});
