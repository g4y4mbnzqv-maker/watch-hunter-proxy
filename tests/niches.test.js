import { afterEach, describe, expect, it, vi } from "vitest";

// Loads the app's modules as a given niche would see them
async function asNiche(key) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_NICHE", key);
  return {
    niche: (await import("@/lib/niche")).niche,
    models: await import("@/lib/models"),
    names: await import("@/lib/nicknames"),
    wording: await import("@/lib/wording"),
    ebay: await import("@/lib/ebay"),
    fakes: await import("@/lib/fakes"),
    overlooked: await import("@/lib/overlooked"),
    profit: await import("@/lib/profit"),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// A fake eBay that records each search and returns the summaries given
function fakeEbay(summaries, categorySuggestions) {
  const searches = [];
  vi.stubGlobal("fetch", async (input) => {
    const url = new URL(String(input));
    if (url.pathname.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 7200 });
    if (url.pathname.endsWith("get_default_category_tree_id")) return Response.json({ categoryTreeId: "3" });
    if (url.pathname.includes("get_category_suggestions")) {
      searches.push(url);
      return Response.json({ categorySuggestions });
    }
    searches.push(url);
    return Response.json({ total: summaries.length, itemSummaries: summaries });
  });
  return searches;
}

const auction = (id, title) => ({
  itemId: id,
  title,
  currentBidPrice: { value: "100" },
  itemEndDate: new Date(Date.now() + 3_600_000).toISOString(),
  itemLocation: { country: "GB" },
});

describe("default", () => {
  it("is Watch Hunter when no niche is set", async () => {
    vi.resetModules();
    const { niche } = await import("@/lib/niche");
    expect(niche.appName).toBe("Watch Hunter");
  });
});

describe("Clothes Hunter", () => {
  it("reads trainer style codes and skips sizes and seasons", async () => {
    const { models } = await asNiche("clothes");
    expect(models.extractModelRef("Nike Dunk Low Panda DD1391-100 UK9")).toBe("DD1391-100");
    expect(models.extractModelRef("Barbour jacket UK10 AW23 W32L32")).toBeNull();
    // Colourways are different shoes
    expect(models.sameModel("DD1391-100", "DD1391-101")).toBe(false);
    expect(models.baseModel("DD1391-100")).toBe("DD1391-100");
  });

  it("knows jacket and trainer names with their brand", async () => {
    const { names } = await asNiche("clothes");
    expect(names.extractModelName("Barbour Bedale wax jacket olive 40")).toBe("Barbour Bedale");
    expect(names.extractModelName("The North Face 1996 Retro Nuptse 700 black L")).toBe("The North Face 1996 Retro Nuptse");
    expect(names.extractModelName("Ghost jacket")).toBeNull();
  });

  it("drops fakes, flags often-faked brands and spots misspellings", async () => {
    const { ebay, fakes, overlooked } = await asNiche("clothes");
    expect(ebay.isReplica("Stone Island inspired overshirt")).toBe(true);
    expect(ebay.isJunk("Nike Dunk box only")).toBe(true);
    expect(fakes.oftenFakedBrand({ title: "Moncler Maya puffer" })).toBe("Moncler");
    expect(overlooked.misspelling("Addidas Samba white", "adidas")).toBe("addidas");
  });

  it("searches the clothing category, found through a suggestion's parents", async () => {
    const { ebay } = await asNiche("clothes");
    const searches = fakeEbay([auction("1", "Barbour Bedale wax jacket")], [
      {
        category: { categoryId: "57988", categoryName: "Coats, Jackets & Waistcoats" },
        categoryTreeNodeAncestors: [
          { categoryId: "1059", categoryName: "Men" },
          { categoryId: "11450", categoryName: "Clothes, Shoes & Accessories" },
        ],
      },
    ]);
    vi.stubEnv("EBAY_CLIENT_ID", "id");
    vi.stubEnv("EBAY_CLIENT_SECRET", "secret");
    await ebay.searchListings("Barbour clothes test");
    expect(searches[0].searchParams.get("q")).toBe("mens jacket");
    expect(searches[1].searchParams.get("category_ids")).toBe("11450");
  });
});

describe("Bike Hunter", () => {
  it("matches bikes by model and groupset, never by part numbers", async () => {
    const { models, names } = await asNiche("bikes");
    expect(models.extractModelRef("Specialized Tarmac SL6 Ultegra R8000 56cm")).toBeNull();
    expect(names.extractModelName("Specialised Tarmac SL6 Ultegra R8000 56cm")).toBe("Specialized Tarmac Ultegra");
    expect(names.extractModelName("Cannondale CAAD12 105 2019 54cm")).toBe("Cannondale CAAD12 105");
    expect(names.extractModelName("Brompton M6L folding bike")).toBe("Brompton M6L");
  });

  it("keeps out frames, wheels and children's bikes, and flags theft warning signs", async () => {
    const { ebay, wording } = await asNiche("bikes");
    expect(ebay.isJunk("Trek Emonda frameset 54cm")).toBe(true);
    expect(ebay.isJunk("Kids Specialized Hotrock 20 inch bike")).toBe(true);
    expect(ebay.isJunk("Giant Defy Advanced 2 105 large")).toBe(false);
    expect(wording.cautionWords("Canyon Grail quick sale cash only no questions")).toEqual(["quick sale", "cash only", "no questions"]);
  });

  it("assumes no postage out by default", async () => {
    const { profit } = await asNiche("bikes");
    expect(profit.DEFAULT_SETTINGS.postageOut).toBe(0);
  });

  it("limits a scan to collection near a postcode", async () => {
    const { ebay } = await asNiche("bikes");
    const searches = fakeEbay([auction("1", "Boardman SLR 8.9 105")], [
      { category: { categoryId: "177831", categoryName: "Bikes" }, categoryTreeNodeAncestors: [] },
    ]);
    vi.stubEnv("EBAY_CLIENT_ID", "id");
    vi.stubEnv("EBAY_CLIENT_SECRET", "secret");
    await ebay.searchListings("Boardman pickup test", { pickup: { postcode: "CB12AB", miles: 25 } });
    const filter = searches.find((url) => url.pathname.endsWith("/search")).searchParams.get("filter");
    expect(filter).toContain("deliveryOptions:{SELLER_ARRANGED_LOCAL_PICKUP}");
    expect(filter).toContain("pickupPostalCode:CB12AB");
    expect(filter).toContain("pickupRadius:25");
    expect(filter).toContain("pickupRadiusUnit:mi");
  });
});

describe("pickupFor", async () => {
  const { pickupFor } = await import("@/lib/postcode");
  it("needs a full postcode and a distance", () => {
    expect(pickupFor("cb1 2ab", "25")).toEqual({ postcode: "CB12AB", miles: 25 });
    expect(pickupFor("CB1", 25)).toBeNull();
    expect(pickupFor("CB1 2AB", 0)).toBeNull();
  });
});
