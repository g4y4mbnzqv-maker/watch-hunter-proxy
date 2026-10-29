import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getComparables, mapPool, searchListings } from "@/lib/ebay";

beforeAll(() => {
  process.env.EBAY_CLIENT_ID = "id";
  process.env.EBAY_CLIENT_SECRET = "secret";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mapPool", () => {
  it("keeps the order of results and never runs more than the limit at once", async () => {
    let running = 0;
    let peak = 0;
    const results = await mapPool([30, 5, 20, 10, 1, 15], 2, async (wait, index) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, wait));
      running--;
      return index;
    });

    expect(results).toEqual([0, 1, 2, 3, 4, 5]);
    expect(peak).toBe(2);
  });

  it("handles an empty list", async () => {
    expect(await mapPool([], 4, async () => 1)).toEqual([]);
  });
});

describe("shared requests", () => {
  it("asks eBay once for a token, the category and each model when calls overlap", async () => {
    const calls = { token: 0, taxonomy: 0, search: 0 };
    vi.stubGlobal("fetch", async (input) => {
      const url = new URL(String(input));
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (url.pathname.includes("oauth2")) {
        calls.token++;
        return Response.json({ access_token: "t", expires_in: 7200 });
      }
      if (url.pathname.includes("taxonomy")) {
        calls.taxonomy++;
        return new Response("", { status: 404 });
      }
      calls.search++;
      return Response.json({ total: 0, itemSummaries: [] });
    });

    const same = [{ itemId: "a", modelRef: "XYZ123", conditionGroup: null }];
    await Promise.all([
      searchListings("shared", { types: ["AUCTION", "BUY_IT_NOW"] }),
      getComparables("shared", same),
      getComparables("shared", [{ ...same[0], itemId: "b" }]),
    ]);

    expect(calls.token).toBe(1);
    expect(calls.taxonomy).toBe(1);
    // Two listing searches plus one shared model lookup
    expect(calls.search).toBe(3);
  });
});
