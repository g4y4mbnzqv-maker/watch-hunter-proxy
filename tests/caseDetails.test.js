import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { caseSize, detailsMatch, isPrecious } from "@/lib/caseDetails";
import { getComparables } from "@/lib/ebay";

describe("case details", () => {
  it("reads case sizes but not strap widths or depths", () => {
    expect(caseSize("Omega Seamaster 300m 41mm automatic")).toBe(41);
    expect(caseSize("Rolex Datejust 36 mm")).toBe(36);
    expect(caseSize("Seiko diver 200m 18mm strap")).toBeNull();
  });

  it("tells solid gold from plated", () => {
    expect(isPrecious("Omega De Ville 18ct gold")).toBe(true);
    expect(isPrecious("Omega De Ville 9k solid gold")).toBe(true);
    expect(isPrecious("Omega De Ville gold plated")).toBe(false);
    expect(isPrecious("Rolex Datejust two tone 18k gold plated bezel")).toBe(false);
    expect(isPrecious("Seiko 5 steel 37mm")).toBe(false);
  });

  it("keeps sizes within 2mm and metals apart", () => {
    const steel40 = { size: 40, precious: false };
    expect(detailsMatch(steel40, "Tissot PRX 40mm")).toBe(true);
    expect(detailsMatch(steel40, "Tissot PRX 35mm")).toBe(false);
    expect(detailsMatch(steel40, "Tissot PRX")).toBe(true);
    expect(detailsMatch(steel40, "Tissot PRX 18ct gold 40mm")).toBe(false);
  });
});

describe("comparables by case details", () => {
  const listing = (title, price) => ({ title, price: { value: String(price) }, itemLocation: { country: "GB" } });

  beforeAll(() => {
    process.env.EBAY_CLIENT_ID = "id";
    process.env.EBAY_CLIENT_SECRET = "secret";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("prices a 35mm watch from 35mm listings when there are enough, and says so", async () => {
    vi.stubGlobal("fetch", async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 7200 });
      if (url.pathname.includes("taxonomy")) return new Response("no", { status: 404 });
      return Response.json({
        itemSummaries: [
          listing("Tissot PRX 35mm quartz", 200),
          listing("Tissot PRX 35mm blue", 210),
          listing("Tissot PRX 35 mm green", 220),
          listing("Tissot PRX 40mm powermatic", 400),
          listing("Tissot PRX 40mm", 420),
          listing("Tissot PRX 40mm ice blue", 440),
        ],
      });
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const comps = await getComparables("tissot size test", [
      { itemId: "a", title: "Tissot PRX 35mm white", modelName: "Tissot PRX" },
      { itemId: "b", title: "Tissot PRX quartz", modelName: "Tissot PRX" },
    ]);

    expect(comps.a).toMatchObject({ median: 210, count: 3, details: "35mm" });
    // Without a size, every PRX counts
    expect(comps.b).toMatchObject({ count: 6 });
    expect(comps.b.details).toBeUndefined();
  });
});
