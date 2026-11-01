import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/scan/route";

describe("scan route", () => {
  beforeAll(() => {
    process.env.EBAY_CLIENT_ID = "id";
    process.env.EBAY_CLIENT_SECRET = "secret";
  });
  afterEach(() => vi.unstubAllGlobals());

  function fakeEbay() {
    const searches = [];
    vi.stubGlobal("fetch", async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 7200 });
      if (url.pathname.includes("taxonomy")) return new Response("no", { status: 404 });
      searches.push(url);
      return Response.json({
        itemSummaries: ["SKX007", "SRPD55", "SNK809"].map((ref, i) => ({
          itemId: `${i}`, title: `Seiko ${ref} diver`, price: { value: "150" }, buyingOptions: ["FIXED_PRICE"], itemLocation: { country: "GB" },
        })),
      });
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    return searches;
  }

  it("skips resale lookups for wanted-list searches", async () => {
    const searches = fakeEbay();
    const res = await GET(new Request("http://localhost/api/scan?brand=Seiko%20route%20test&types=BUY_IT_NOW&estimates=0"));
    const data = await res.json();
    expect(data.results).toHaveLength(3);
    expect(searches).toHaveLength(1);
  });

  it("turns away very long searches", async () => {
    fakeEbay();
    const res = await GET(new Request(`http://localhost/api/scan?brand=${"a".repeat(150)}`));
    expect(res.status).toBe(400);
  });
});
