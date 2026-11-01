import { describe, expect, it } from "vitest";
import { readJson } from "../app/client/readJson";
import { toCsv } from "@/lib/dealLog";
import { DEFAULT_SETTINGS } from "@/lib/profit";

describe("server replies that aren't JSON", () => {
  it("turns a time-out page into a plain message", async () => {
    const data = await readJson(new Response("<html>An error occurred</html>", { status: 504 }));
    expect(data).toEqual({ error: true, message: "eBay took too long to answer. Try again in a moment." });
    expect(await readJson(new Response('{"ok":true}'))).toEqual({ ok: true });
  });
});

describe("CSV safety", () => {
  it("stops a seller's title running as a spreadsheet formula, and leaves numbers alone", () => {
    const csv = toCsv(
      [{ title: '=HYPERLINK("http://x","click")', brand: "Seiko", boughtFor: 100, soldFor: 80, soldOn: "2026-10-01", platform: "vinted", fees: "", postageOut: 30 }],
      DEFAULT_SETTINGS
    );
    const row = csv.split("\n")[1];
    expect(row.startsWith(`"'=HYPERLINK(`)).toBe(true);
    // The loss stays a number
    expect(row).toContain(",-50,");
  });
});
