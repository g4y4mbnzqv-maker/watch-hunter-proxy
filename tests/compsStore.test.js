import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestDatabase } from "@/lib/db";
import { COMPS_STORE_MS, readComps, saveComps } from "@/lib/compsStore";
import { getComparables } from "@/lib/ebay";

describe("saved resale prices", () => {
  beforeAll(() => {
    process.env.EBAY_CLIENT_ID = "id";
    process.env.EBAY_CLIENT_SECRET = "secret";
  });
  beforeEach(() => {
    const pg = new PGlite();
    setTestDatabase(async (text, params) => (await pg.query(text, params)).rows);
  });
  afterEach(() => {
    setTestDatabase(null);
    vi.unstubAllGlobals();
  });

  it("keeps a lookup for six hours", async () => {
    await saveComps("seiko|ref:SKX007|USED", [{ title: "Seiko SKX007", price: 250 }]);
    expect((await readComps("seiko|ref:SKX007|USED")).listings).toEqual([{ title: "Seiko SKX007", price: 250 }]);
    expect(await readComps("seiko|ref:SKX007|USED", Date.now() + COMPS_STORE_MS + 1000)).toBeNull();
    expect(await readComps("seiko|ref:NOPE|USED")).toBeNull();
  });

  it("uses a saved lookup instead of asking eBay again", async () => {
    const titles = ["Seiko SRPE93 a", "Seiko SRPE93 b", "Seiko SRPE93 c"];
    await saveComps("seiko store test|ref:SRPE93|ANY", titles.map((title, i) => ({ title, price: 200 + i * 10 })));
    const searches = [];
    vi.stubGlobal("fetch", async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 7200 });
      if (url.pathname.includes("taxonomy")) return new Response("no", { status: 404 });
      searches.push(url);
      return Response.json({ itemSummaries: [] });
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const comps = await getComparables("seiko store test", [{ itemId: "x", modelRef: "SRPE93", title: "Seiko SRPE93" }]);

    expect(comps.x).toMatchObject({ median: 210, count: 3 });
    expect(searches).toHaveLength(0);
  });
});
