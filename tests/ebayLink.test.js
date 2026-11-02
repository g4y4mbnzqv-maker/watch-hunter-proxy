import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { isEbayUrl, itemNumber, linkFromText, resolveItemNumber } from "@/lib/ebayLink";
import { GET } from "@/app/api/link/route";

describe("eBay links", () => {
  it("finds the link in shared text", () => {
    expect(linkFromText("Check out this item on eBay https://ebay.io/m/4piqhG")).toBe("https://ebay.io/m/4piqhG");
    expect(linkFromText("ebay.io/m/4piqhG")).toBe("https://ebay.io/m/4piqhG");
    expect(linkFromText(" 205812345678 ")).toBe("205812345678");
    expect(linkFromText("no link here")).toBeNull();
  });

  it("reads item numbers from eBay addresses only", () => {
    expect(itemNumber("https://www.ebay.co.uk/itm/205812345678?mkcid=16")).toBe("205812345678");
    expect(itemNumber("https://www.ebay.co.uk/itm/seiko-diver-skx007/205812345678")).toBe("205812345678");
    expect(itemNumber("https://m.ebay.com/itm/205812345678")).toBe("205812345678");
    expect(itemNumber("https://www.ebay.co.uk/sch/i.html?item=205812345678")).toBe("205812345678");
    expect(itemNumber("https://evil.example/itm/205812345678")).toBeNull();
    expect(itemNumber("https://ebay.co.uk.evil.example/itm/205812345678")).toBeNull();
    expect(isEbayUrl("https://ebay.io/m/x")).toBe(true);
    expect(isEbayUrl("https://notebay.io/m/x")).toBe(false);
  });

  it("follows share links to the listing, and never off eBay", async () => {
    const seen = [];
    const fake = async (url) => {
      seen.push(url);
      if (url.includes("ebay.io")) return new Response(null, { status: 301, headers: { location: "https://www.ebay.co.uk/itm/205812345678?_trksid=1" } });
      throw new Error("should not fetch the listing page");
    };
    expect(await resolveItemNumber("https://ebay.io/m/4piqhG", fake)).toBe("205812345678");
    expect(seen).toEqual(["https://ebay.io/m/4piqhG"]);

    const offsite = async () => new Response(null, { status: 302, headers: { location: "https://evil.example/" } });
    expect(await resolveItemNumber("https://ebay.io/m/x", offsite)).toBeNull();

    const page = async () =>
      new Response('<script>location="https:\\/\\/www.ebay.co.uk\\/itm\\/123456789012"</script>', { headers: { "content-type": "text/html" } });
    expect(await resolveItemNumber("https://ebay.us/abc", page)).toBe("123456789012");

    const down = async () => {
      throw new TypeError("fetch failed");
    };
    expect(await resolveItemNumber("https://ebay.io/m/x", down)).toBeNull();

    let hops = 0;
    const loop = async () => {
      hops++;
      return new Response(null, { status: 302, headers: { location: "https://ebay.io/m/again" } });
    };
    expect(await resolveItemNumber("https://ebay.io/m/x", loop)).toBeNull();
    expect(hops).toBe(6);
  });
});

describe("/api/link", () => {
  beforeAll(() => {
    process.env.EBAY_CLIENT_ID = "id";
    process.env.EBAY_CLIENT_SECRET = "secret";
  });
  afterEach(() => vi.unstubAllGlobals());

  function stubEbay({ listing }) {
    vi.stubGlobal("fetch", async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "ebay.io") return new Response(null, { status: 301, headers: { location: "https://www.ebay.co.uk/itm/205812345678" } });
      if (url.pathname.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 7200 });
      if (url.pathname.includes("taxonomy")) return new Response("no", { status: 404 });
      if (url.pathname.endsWith("get_item_by_legacy_id")) {
        expect(url.searchParams.get("legacy_item_id")).toBe("205812345678");
        return listing ? Response.json(listing) : new Response("gone", { status: 404 });
      }
      return Response.json({
        itemSummaries: [200, 210, 220].map((price) => ({ title: "Seiko SKX007 diver", price: { value: String(price) }, itemLocation: { country: "GB" } })),
      });
    });
  }

  const call = (text) => GET(new Request(`https://app.test/api/link?url=${encodeURIComponent(text)}`));

  it("returns the listing and today's asking prices", async () => {
    stubEbay({
      listing: {
        itemId: "v1|205812345678|0",
        title: "Seiko SKX007 diver automatic",
        itemWebUrl: "https://www.ebay.co.uk/itm/205812345678",
        price: { value: "120.00" },
        buyingOptions: ["FIXED_PRICE"],
        shippingOptions: [{ shippingCost: { value: "4.50" } }],
        image: { imageUrl: "https://i.ebayimg.com/a.jpg" },
      },
    });
    const data = await (await call("Look at this https://ebay.io/m/4piqhG")).json();
    expect(data.found).toBe(true);
    expect(data.item).toMatchObject({ itemId: "v1|205812345678|0", brand: "Seiko", totalCost: 124.5 });
    expect(data.comps).toMatchObject({ median: 210 });
  });

  it("falls back to the link when the listing has ended", async () => {
    stubEbay({ listing: null });
    const data = await (await call("https://ebay.io/m/4piqhG")).json();
    expect(data).toEqual({ found: false, itemNumber: "205812345678", url: "https://www.ebay.co.uk/itm/205812345678" });
  });

  it("turns away links that aren't eBay's", async () => {
    const res = await call("https://example.com/itm/205812345678");
    expect(res.status).toBe(400);
  });
});
