import { describe, expect, it } from "vitest";
import { misspelling, overlookedReasons, overnightEnd, typoQuery } from "@/lib/overlooked";

describe("typoQuery", () => {
  it("joins a brand's misspellings as eBay alternatives", () => {
    expect(typoQuery("Omega")).toBe("(omgea, omaga, omeaga, omefa)");
    expect(typoQuery("Nomos")).toBeNull();
  });
});

describe("misspelling", () => {
  it("finds a whole-word misspelling in the title", () => {
    expect(misspelling("Vintage SIEKO 5 automatic", "seiko")).toBe("sieko");
    expect(misspelling("Seiko 5 automatic", "seiko")).toBeNull();
  });
});

describe("overnightEnd", () => {
  it("gives UK time for auctions ending between midnight and 7am", () => {
    // British Summer Time: 02:12 UTC is 3:12am in London
    expect(overnightEnd("2026-07-10T02:12:00Z")).toBe("3:12am");
    // Winter: 00:05 UTC is 12:05am
    expect(overnightEnd("2026-12-10T00:05:00Z")).toBe("12:05am");
    expect(overnightEnd("2026-12-10T07:00:00Z")).toBeNull();
    expect(overnightEnd(null)).toBeNull();
  });
});

describe("overlookedReasons", () => {
  const base = {
    title: "Seiko SKX007 automatic divers watch on jubilee",
    listingType: "AUCTION",
    endTime: "2026-12-10T20:00:00Z",
    images: ["a", "b", "c"],
  };

  it("has nothing to say about a normal listing", () => {
    expect(overlookedReasons(base)).toEqual([]);
  });

  it("lists each reason fewer buyers may see it", () => {
    expect(
      overlookedReasons({ ...base, misspelt: "sieko", title: "Sieko watch", endTime: "2026-12-10T04:30:00Z", images: ["a"] })
    ).toEqual(['the brand is misspelt "sieko"', "it ends at 4:30am", "it has one photo", "the title is short"]);
  });

  it("ignores end times on Buy It Now listings", () => {
    expect(overlookedReasons({ ...base, listingType: "BUY_IT_NOW", endTime: "2026-12-10T04:30:00Z" })).toEqual([]);
  });
});
