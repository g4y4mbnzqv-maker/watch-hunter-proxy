import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { checkPrices } from "@/lib/priceCheck";
import { pastSales } from "@/lib/dealLog";

describe("price check for your own watches", () => {
  beforeAll(() => {
    process.env.EBAY_CLIENT_ID = "id";
    process.env.EBAY_CLIENT_SECRET = "secret";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("prices titles with a model and skips ones without", async () => {
    const queries = [];
    vi.stubGlobal("fetch", async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 7200 });
      if (url.pathname.includes("taxonomy")) return new Response("no", { status: 404 });
      queries.push(url.searchParams.get("q"));
      return Response.json({
        itemSummaries: [200, 210, 220].map((price) => ({ title: "Citizen NY0040 diver", price: { value: String(price) }, itemLocation: { country: "GB" } })),
      });
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const [priced, unknown] = await checkPrices(["Citizen Promaster NY0040 diver", "old gents watch"]);
    expect(priced).toMatchObject({ median: 210, count: 3 });
    expect(unknown).toBeNull();
    expect(queries[0]).toBe("Citizen NY0040");
  });
});

describe("pastSales", () => {
  it("finds earlier sales of the same model, newest first", () => {
    const keyOf = (title) => (title.includes("SKX007") ? "SKX007" : null);
    const deals = [
      { id: "1", title: "Seiko SKX007", soldFor: 200, soldOn: "2026-09-01" },
      { id: "2", title: "Seiko SKX007 jubilee", soldFor: 230, soldOn: "2026-10-01" },
      { id: "3", title: "Seiko SKX007", soldFor: "" },
      { id: "4", title: "Citizen", soldFor: 90, soldOn: "2026-10-02" },
    ];
    expect(pastSales(deals, "SKX007 boxed", keyOf).map((deal) => deal.id)).toEqual(["2", "1"]);
  });
});
