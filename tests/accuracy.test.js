import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getComparables, isJunk } from "@/lib/ebay";
import { isLadies } from "@/lib/caseDetails";
import { roughEstimateReasons } from "@/lib/profit";

// Cases found by a live check of the Top deals brands
describe("parts and straps", () => {
  it("drops loose straps and dial-and-hands sets", () => {
    expect(isJunk("Studio Underd0g 02 Series Badalassi Wax Calfskin Strap - Tan")).toBe(true);
    expect(isJunk("Hamilton Pan Europe Canvas Strap Grey")).toBe(true);
    expect(isJunk("Omega Seamaster dial and hands")).toBe(true);
  });

  it("keeps watches that come on a strap", () => {
    expect(isJunk("Seiko SKX007 diver on leather strap")).toBe(false);
    expect(isJunk("Orient RA-AP0002S10A 40.5mm Silver Stainless Steel Case with Brown Leather Band")).toBe(false);
    expect(isJunk("Orient Mako 40 Black Silicone Strap Good Condition")).toBe(false);
    expect(isJunk("Seiko 5 Automatic Blue Dial")).toBe(false);
  });
});

describe("ladies' and vintage watches", () => {
  beforeAll(() => {
    process.env.EBAY_CLIENT_ID = "id";
    process.env.EBAY_CLIENT_SECRET = "secret";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("never compares ladies' watches with men's", async () => {
    expect(isLadies("Vintage Hamilton Intra-Matic Ladies Watch")).toBe(true);
    expect(isLadies("Omega De Ville 18ct Women's Watch")).toBe(true);
    expect(isLadies("Hamilton Khaki Field 38mm")).toBe(false);

    vi.stubGlobal("fetch", async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 7200 });
      if (url.pathname.includes("taxonomy")) return new Response("no", { status: 404 });
      return Response.json({
        itemSummaries: [
          ...[1500, 1600, 1700, 1800].map((p) => ({ title: "Hamilton Intra-Matic Auto 40mm", price: { value: String(p) } })),
          ...[300, 320, 340].map((p) => ({ title: "Hamilton Intra-Matic Ladies quartz", price: { value: String(p) } })),
        ].map((i) => ({ ...i, itemLocation: { country: "GB" } })),
      });
    });
    const items = [
      { itemId: "m", title: "Hamilton Intra-Matic automatic", modelName: "Hamilton Intra-Matic", conditionGroup: "USED" },
      { itemId: "l", title: "Hamilton Intra-Matic Ladies watch", modelName: "Hamilton Intra-Matic", conditionGroup: "USED" },
    ];
    const comps = await getComparables("Hamilton", items);
    expect(comps.m.median).toBe(1650);
    expect(comps.l.median).toBe(320);
  });

  it("marks vintage estimates as rough", () => {
    expect(roughEstimateReasons({ title: "Vintage Tissot Seastar quartz", comps: { count: 10, low: 100, high: 200 } })).toContain(
      "vintage, so newer listings may not compare"
    );
  });
});

describe("reference with too few listings", () => {
  beforeAll(() => {
    process.env.EBAY_CLIENT_ID = "id";
    process.env.EBAY_CLIENT_SECRET = "secret";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("falls back to the model name in the title", async () => {
    const queries = [];
    vi.stubGlobal("fetch", async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 7200 });
      if (url.pathname.includes("taxonomy")) return new Response("no", { status: 404 });
      const q = url.searchParams.get("q");
      queries.push(q);
      const summaries = q.includes("FAA02004B9") ? [] : [120, 130, 140, 150].map((p) => ({ title: "Orient Ray II automatic diver", price: { value: String(p) } }));
      return Response.json({ itemSummaries: summaries.map((i) => ({ ...i, itemLocation: { country: "GB" } })) });
    });
    const item = { itemId: "r", title: "Orient Ray II - FAA02004B9", modelRef: "FAA02004B9", conditionGroup: "USED" };
    const comps = await getComparables("Orient", [item]);
    expect(comps.r).toMatchObject({ median: 135, matchedBy: "name" });
    expect(queries.some((q) => q === "Orient Ray")).toBe(true);
  });

  it("ignores a seller's PWS stock codes", async () => {
    const { extractModelRef } = await import("@/lib/models");
    expect(extractModelRef("Seiko Ladies Gold Tone Quartz Dress Watch PWS1936")).toBeNull();
  });
});

describe("bracelets sold on their own", () => {
  it("drops bracelets, links and clasps", () => {
    for (const title of [
      "Genuine Seiko Jubilee Bracelet 22mm for SKX007 SKX009",
      "Rolex Oyster bracelet 93150 end links 501B",
      "Stainless steel bracelet to fit Seiko SKX 22mm",
      "Seiko SKX007 replacement bracelet",
      "Tudor Black Bay bracelet links x3",
      "Omega deployant clasp 18mm",
      "Rolex jubilee bracelet 62510H 20mm",
      "Strapcode super oyster bracelet fits Seiko Turtle",
    ]) expect(isJunk(title), title).toBe(true);
  });

  it("keeps watches that come on a bracelet", () => {
    for (const title of [
      "Rolex Datejust 16234 Jubilee bracelet",
      "Seiko SKX007 on jubilee bracelet with spare links",
      "Omega Seamaster 300m 2531.80 full links box",
      "Tudor Black Bay 58 bracelet 39mm",
      "Casio G-Shock with metal bracelet",
      "Citizen Eco-Drive bracelet 40mm",
    ]) expect(isJunk(title), title).toBe(false);
  });
});

describe("gender", () => {
  it("reads men's, ladies' and unisex from the title", async () => {
    const { genderOf, fitsGender } = await import("@/lib/caseDetails");
    expect(genderOf("Seiko 5 Mens Automatic")).toBe("mens");
    expect(genderOf("Gents Rotary dress watch")).toBe("mens");
    expect(genderOf("Womens Citizen Eco-Drive")).toBe("ladies");
    expect(genderOf("Omega Ladies' De Ville")).toBe("ladies");
    expect(genderOf("Swatch unisex")).toBe("unisex");
    expect(genderOf("His and hers: mens and ladies Seiko pair")).toBe("unisex");
    expect(genderOf("Seiko SKX007 diver")).toBeNull();
    expect(fitsGender("Seiko SKX007 diver", "mens")).toBe(true);
    expect(fitsGender("Omega Ladies' De Ville", "mens")).toBe(false);
    expect(fitsGender("Seiko SKX007 diver", "ladies")).toBe(false);
    expect(fitsGender("Swatch unisex", "ladies")).toBe(true);
    expect(fitsGender("anything", "all")).toBe(true);
  });
});
