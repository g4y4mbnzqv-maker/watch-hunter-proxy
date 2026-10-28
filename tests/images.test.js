import { describe, expect, it } from "vitest";
import { ebayImage } from "@/lib/images";

describe("ebayImage", () => {
  it("asks eBay for a bigger copy of a sized picture", () => {
    expect(ebayImage("https://i.ebayimg.com/images/g/AbCAAOSw/s-l225.jpg", 1600)).toBe(
      "https://i.ebayimg.com/images/g/AbCAAOSw/s-l1600.jpg"
    );
    expect(ebayImage("https://i.ebayimg.com/images/g/AbCAAOSw/s-l140.webp", 500)).toBe(
      "https://i.ebayimg.com/images/g/AbCAAOSw/s-l500.webp"
    );
  });

  it("uses the full picture path for thumbnail URLs", () => {
    expect(ebayImage("https://i.ebayimg.com/thumbs/images/g/AbCAAOSw/s-l225.jpg", 500)).toBe(
      "https://i.ebayimg.com/images/g/AbCAAOSw/s-l500.jpg"
    );
  });

  it("leaves other URLs alone", () => {
    expect(ebayImage("https://example.com/watch.jpg", 500)).toBe("https://example.com/watch.jpg");
    expect(ebayImage(undefined, 500)).toBeUndefined();
  });
});
