import { describe, expect, it } from "vitest";
import { isGem } from "@/lib/gems";

describe("hidden gems", () => {
  it("keeps cheap listings with no brand in the title", () => {
    expect(isGem({ title: "Old gents automatic watch 17 jewels", totalCost: 35 })).toBe(true);
    expect(isGem({ title: "Omega vintage gents watch", totalCost: 35 })).toBe(false);
    expect(isGem({ title: "Old gents watch", totalCost: 120 })).toBe(false);
  });
});
