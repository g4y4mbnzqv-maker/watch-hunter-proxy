import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { similarByPhoto } from "@/lib/ebay";

describe("similar by photo", () => {
  beforeAll(() => {
    process.env.EBAY_CLIENT_ID = "id";
    process.env.EBAY_CLIENT_SECRET = "secret";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("only fetches eBay photos", async () => {
    await expect(similarByPhoto("https://evil.example/x.jpg")).rejects.toThrow("Only eBay photos");
    await expect(similarByPhoto("not a url")).rejects.toThrow("isn't a photo");
  });

  it("sends the photo and leaves out the listing itself, straps and replicas", async () => {
    const calls = [];
    vi.stubGlobal("fetch", async (input, init) => {
      const url = new URL(String(input));
      calls.push(url.toString());
      if (url.hostname === "i.ebayimg.com") return new Response(new Uint8Array([1, 2, 3]));
      if (url.pathname.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 7200 });
      if (url.pathname.includes("taxonomy")) return new Response("no", { status: 404 });
      expect(JSON.parse(init.body).image).toBe("AQID");
      const item = (id, title, price) => ({ itemId: id, title, price: { value: String(price) }, itemLocation: { country: "GB" } });
      return Response.json({
        itemSummaries: [
          item("self", "Swatch Gravitation", 70),
          item("a", "Swatch Gravitation SVDK1001 automatic", 84),
          item("b", "Swatch replacement strap", 9),
          item("c", "Rolex style homage", 40),
        ],
      });
    });
    const found = await similarByPhoto("https://i.ebayimg.com/images/g/abc/s-l225.jpg", { excludeId: "self" });
    expect(found.map((item) => item.itemId)).toEqual(["a"]);
    expect(calls[0]).toBe("https://i.ebayimg.com/images/g/abc/s-l500.jpg");
  });
});
