import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestDatabase } from "@/lib/db";
import { authorizeUrl, finishSignIn, prepareListing, publish, sellStatus, sellUnavailable } from "@/lib/ebaySell";
import { listingProblem } from "@/lib/ebayListing";
import { GET as callback } from "@/app/api/ebay/callback/route";

let pg;
beforeEach(() => {
  pg = new PGlite();
  setTestDatabase(async (text, params) => (await pg.query(text, params)).rows);
  process.env.EBAY_CLIENT_ID = "app-id";
  process.env.EBAY_CLIENT_SECRET = "cert-id";
  process.env.EBAY_RUNAME = "My_Name-Watch-PRD-runame";
  process.env.APP_PASSCODE = "secret";
});
afterEach(() => {
  setTestDatabase(null);
  vi.unstubAllGlobals();
  delete process.env.EBAY_RUNAME;
  delete process.env.APP_PASSCODE;
});

const good = {
  dealId: "123-v1|9|0", title: "Seiko SKX007 automatic diver", description: "Lovely watch, running well.", brand: "Seiko",
  model: "SKX007", reference: "SKX007", department: "Men", condition: "PRE_OWNED_EXCELLENT", price: 249, bestOffer: true, minOffer: 210,
  photos: ["https://i.ebayimg.com/a.jpg"],
};

// A fake eBay: token endpoint, account policies, location, inventory and offers
function fakeEbay({ policies = true, location = true } = {}) {
  const calls = [];
  vi.stubGlobal("fetch", async (input, init = {}) => {
    const url = new URL(String(input));
    const body = init.body && typeof init.body === "string" && init.body.startsWith("{") ? JSON.parse(init.body) : init.body;
    calls.push({ method: init.method ?? "GET", path: url.pathname + url.search, body, auth: init.headers?.Authorization });
    if (url.pathname.endsWith("/oauth2/token")) return Response.json({ access_token: "user-token", expires_in: 7200, refresh_token: "refresh", refresh_token_expires_in: 47304000 });
    if (url.pathname.includes("_policy")) {
      const kind = url.pathname.split("/").pop().replace("_policy", "");
      const list = { fulfillment: "fulfillmentPolicies", payment: "paymentPolicies", return: "returnPolicies" }[kind];
      return Response.json(policies ? { [list]: [{ [`${kind}PolicyId`]: `${kind}-1`, name: `My ${kind}` }] } : { [list]: [] });
    }
    if (url.pathname.includes("/location/")) return location ? Response.json({}) : new Response("", { status: 404 });
    if (url.pathname.includes("/inventory_item/")) return new Response(null, { status: 204 });
    if (url.pathname.endsWith("/offer") && (init.method ?? "GET") === "GET") return Response.json({ offers: [] });
    if (url.pathname.endsWith("/offer")) return Response.json({ offerId: "555" });
    if (url.pathname.endsWith("/publish")) return Response.json({ listingId: "287700000001" });
    return new Response("not faked", { status: 500 });
  });
  return calls;
}

describe("listing on eBay", () => {
  it("refuses to sell without the passcode lock", async () => {
    delete process.env.APP_PASSCODE;
    expect(sellUnavailable()).toBe("no-passcode");
    await expect(publish("123")).rejects.toThrow("isn't set up");
    await expect(finishSignIn("code")).rejects.toThrow("isn't set up");
  });

  it("needs the RuName setting before anything else", () => {
    delete process.env.EBAY_RUNAME;
    expect(sellUnavailable()).toBe("no-runame");
  });

  it("asks eBay for the selling scopes", () => {
    const url = new URL(authorizeUrl("abc"));
    expect(url.searchParams.get("redirect_uri")).toBe("My_Name-Watch-PRD-runame");
    expect(url.searchParams.get("scope")).toContain("sell.inventory");
    expect(url.searchParams.get("state")).toBe("abc");
  });

  it("checks a listing before sending it", () => {
    expect(listingProblem(good)).toBeNull();
    expect(listingProblem({ ...good, description: "Case is [size]mm" })).toMatch(/brackets/);
    expect(listingProblem({ ...good, photos: [] })).toMatch(/photo/);
    expect(listingProblem({ ...good, minOffer: 300 })).toMatch(/lowest offer/);
  });

  it("signs in, then reads policies and location", async () => {
    fakeEbay();
    expect(await sellStatus()).toEqual({ connected: false });
    await finishSignIn("code-from-ebay");
    expect(await sellStatus()).toMatchObject({ connected: true, location: true, policies: { payment: { id: "payment-1", name: "My payment" } } });
  });

  it("saves the watch and an offer, then publishes it", async () => {
    const calls = fakeEbay();
    await finishSignIn("code");
    const { sku, offerId } = await prepareListing(good);
    expect(sku).toBe("wh-123-v190");
    expect(offerId).toBe("555");
    const item = calls.find((c) => c.path.includes("/inventory_item/"));
    expect(item.method).toBe("PUT");
    expect(item.auth).toBe("Bearer user-token");
    expect(item.body.product.aspects).toEqual({ Brand: ["Seiko"], Department: ["Men"], Type: ["Wristwatch"], Model: ["SKX007"], "Reference Number": ["SKX007"] });
    const offer = calls.find((c) => c.method === "POST" && c.path.endsWith("/offer"));
    expect(offer.body).toMatchObject({
      categoryId: "31387", pricingSummary: { price: { value: "249.00", currency: "GBP" } },
      listingPolicies: { fulfillmentPolicyId: "fulfillment-1", returnPolicyId: "return-1", bestOfferTerms: { bestOfferEnabled: true, autoDeclinePrice: { value: "210.00" } } },
    });
    expect(await publish(offerId)).toEqual({ listingId: "287700000001", url: "https://www.ebay.co.uk/itm/287700000001" });
  });

  it("stops with a clear message without business policies", async () => {
    fakeEbay({ policies: false });
    await finishSignIn("code");
    await expect(prepareListing(good)).rejects.toThrow(/Business policies/);
  });

  it("only accepts a sign-in this app started", async () => {
    fakeEbay();
    const res = await callback(new Request("https://app.test/api/ebay/callback?code=x&state=forged", { headers: { cookie: "wh_ebay_state=abc123" } }));
    expect(res.headers.get("location")).toContain("ebay=error");
    const ok = await callback(new Request("https://app.test/api/ebay/callback?code=x&state=abc123", { headers: { cookie: "wh_ebay_state=abc123" } }));
    expect(ok.headers.get("location")).toContain("ebay=connected");
  });
});
