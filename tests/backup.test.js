import { describe, expect, it } from "vitest";
import { readBackup } from "../app/client/backup";

describe("backup files", () => {
  it("accepts a backup and keeps only the app's own data", () => {
    const text = JSON.stringify({ app: "watch-hunter", version: 1, exportedAt: "2026-11-01T10:00:00Z", data: { "wh-deals": [{ id: "a" }], "something-else": 1 } });
    expect(readBackup(text)).toEqual({ data: { "wh-deals": [{ id: "a" }] }, exportedAt: "2026-11-01T10:00:00Z" });
  });

  it("turns away other files", () => {
    expect(() => readBackup("not json")).toThrow(/isn't a Watch Hunter backup/);
    expect(() => readBackup(JSON.stringify({ app: "other", data: {} }))).toThrow(/isn't a Watch Hunter backup/);
    expect(() => readBackup(JSON.stringify({ app: "watch-hunter", version: 9, data: {} }))).toThrow(/newer version/);
  });
});
