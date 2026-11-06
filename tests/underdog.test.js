import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { brandFromTitle, searchQuery } from "@/lib/brands";
import { extractModelName } from "@/lib/nicknames";
import { searchListings } from "@/lib/ebay";

describe("Studio Underdog's zero spellings", () => {
  it("searches both spellings of the brand and its model names", () => {
    expect(searchQuery("studio underdog")).toBe("studio (underdog, underd0g)");
    expect(searchQuery("Studio Underd0g Watermelon")).toBe("studio (underdog, underd0g) (watermelon, watermel0n)");
    expect(searchQuery("studio underdog pepperoni")).toContain("(pepperoni, pepper0ni)");
  });

  it("leaves other searches alone", () => {
    expect(searchQuery("Seiko SKX007")).toBe("Seiko SKX007");
    expect(searchQuery("(sieko, seico)")).toBe("(sieko, seico)");
  });

  it("recognises the brand and models however they're spelt", () => {
    expect(brandFromTitle("Studio Underd0g Watermel0n 01 Series chronograph")).toBe("Studio Underdog");
    expect(brandFromTitle("STUDIO UNDERDOG Goofy Panda")).toBe("Studio Underdog");
    expect(extractModelName("Studio Underd0g Watermel0n chronograph")).toBe("Studio Underdog Watermelon");
    expect(extractModelName("Studio Underdog Pink Lemonade field watch")).toBe("Studio Underdog Pink Lemonade");
    expect(extractModelName("Studio Underd0g Go0fy Panda")).toBe("Studio Underdog Goofy Panda");
    // Other brands still need their own name in the title
    expect(extractModelName("Seiko Turtle SRP777")).toBe("Seiko Turtle");
  });
});

describe("scanning Studio Underdog", () => {
  beforeAll(() => {
    process.env.EBAY_CLIENT_ID = "id";
    process.env.EBAY_CLIENT_SECRET = "secret";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends eBay the search with both spellings", async () => {
    const queries = [];
    vi.stubGlobal("fetch", async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 7200 });
      if (url.pathname.includes("taxonomy")) return new Response("no", { status: 404 });
      queries.push(url.searchParams.get("q"));
      return Response.json({
        total: 1,
        itemSummaries: [
          {
            itemId: "v1|1|0",
            title: "Studio Underd0g Watermel0n chronograph",
            price: { value: "350" },
            buyingOptions: ["FIXED_PRICE"],
            itemLocation: { country: "GB" },
          },
        ],
      });
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { items } = await searchListings("Studio Underdog", { types: ["BUY_IT_NOW"] });
    expect(queries[0]).toBe("studio (underdog, underd0g)");
    expect(items[0]).toMatchObject({ modelName: "Studio Underdog Watermelon" });
  });
});

describe("Studio Underdog titles", () => {
  it("don't treat the movement or the series as the model", async () => {
    const { extractModelRef } = await import("@/lib/models");
    expect(extractModelRef("Studio Underd0g Goofy Panda Biompax ST-1901 Auto Chronograph")).toBeNull();
    expect(extractModelRef("Studio Underd0g 02Series Pink Lem0nade Watch")).toBeNull();
    expect(extractModelRef("Studio Underd0g Gen2 Watermelon Watch ST1901 Movement")).toBeNull();
    expect(extractModelName("Studio Underd0g 02Series Pink Lem0nade Watch")).toBe("Studio Underdog Pink Lemonade");
    expect(extractModelRef("Studio Underd0g Desert Sky ST-1901 (Gen 3) Chronograph 38.5mm")).toBeNull();
    // Ordinary references still count
    expect(extractModelRef("Seiko SKX007 diver")).toBe("SKX007");
  });
});
