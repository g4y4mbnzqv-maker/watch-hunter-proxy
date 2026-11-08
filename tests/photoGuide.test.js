import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { photoGuide } from "@/lib/photoGuide";
import { DEFAULT_SETTINGS } from "@/lib/profit";
import { POST } from "@/app/api/similar/upload/route";

describe("photo price guide", () => {
  it("prices from the ticked matches, with the most to pay", () => {
    // Defaults: 85% expected sale, 13% fees, £5 postage out, £30 target
    const guide = photoGuide([250, 280, 300], DEFAULT_SETTINGS);
    expect(guide).toMatchObject({ count: 3, low: 250, high: 300, median: 280, resale: 238, roughReason: null });
    // 238 - 30.94 fees - 5 postage - 0 extras - 30 target = 172.06
    expect(guide.maxPay).toBe(172);
  });

  it("says when the guide is rough, and never goes below zero", () => {
    expect(photoGuide([100], DEFAULT_SETTINGS).roughReason).toMatch(/few matches/);
    expect(photoGuide([40, 60, 200], DEFAULT_SETTINGS).roughReason).toMatch(/vary/);
    expect(photoGuide([20], DEFAULT_SETTINGS).maxPay).toBe(0);
    expect(photoGuide([], DEFAULT_SETTINGS)).toBeNull();
  });
});

describe("photo upload search", () => {
  beforeAll(() => {
    process.env.EBAY_CLIENT_ID = "id";
    process.env.EBAY_CLIENT_SECRET = "secret";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends your photo to eBay's image search", async () => {
    let sent;
    vi.stubGlobal("fetch", async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 7200 });
      if (url.pathname.includes("taxonomy")) return new Response("no", { status: 404 });
      sent = JSON.parse(init.body).image;
      return Response.json({ itemSummaries: [{ itemId: "a", title: "Seiko SKX007 diver", price: { value: "250" }, itemLocation: { country: "GB" } }] });
    });
    const body = new FormData();
    body.append("photo", new Blob([new Uint8Array([9, 8, 7])], { type: "image/jpeg" }), "w.jpg");
    const res = await POST(new Request("https://app.test/api/similar/upload", { method: "POST", body }));
    const data = await res.json();
    expect(sent).toBe("CQgH");
    expect(data.items.map((item) => item.title)).toEqual(["Seiko SKX007 diver"]);
  });

  it("asks for a photo when none is sent", async () => {
    const res = await POST(new Request("https://app.test/api/similar/upload", { method: "POST", body: new FormData() }));
    expect(res.status).toBe(400);
  });
});
