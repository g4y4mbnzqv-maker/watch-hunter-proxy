import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestDatabase } from "@/lib/db";
import { readState, syncUnavailable, writeState } from "@/lib/userState";
import { combine, reconcile } from "../app/client/sync";

describe("user state in the database", () => {
  beforeEach(() => {
    const pg = new PGlite();
    setTestDatabase(async (text, params) => (await pg.query(text, params)).rows);
  });
  afterEach(() => {
    setTestDatabase(null);
    vi.unstubAllEnvs();
  });

  it("keeps the newest change and tells an older device what's newer", async () => {
    await writeState("wh-settings", { maxBudget: 600 }, 2000);
    const stale = await writeState("wh-settings", { maxBudget: 300 }, 1000);
    expect(stale).toEqual({ value: { maxBudget: 600 }, changedAt: 2000, saved: false });

    const fresh = await writeState("wh-settings", { maxBudget: 500 }, 3000);
    expect(fresh.saved).toBe(true);
    expect(await readState()).toEqual({ "wh-settings": { value: { maxBudget: 500 }, changedAt: 3000 } });
  });

  it("only syncs with a passcode set, so strangers can't read your data", () => {
    vi.stubEnv("APP_PASSCODE", "");
    expect(syncUnavailable()).toBe("no-passcode");
    vi.stubEnv("APP_PASSCODE", "secret");
    expect(syncUnavailable()).toBeNull();
  });
});

describe("reconcile", () => {
  it("sends local data up when the server has none", () => {
    expect(reconcile("wh-deals", [{ id: "a" }], 0, undefined)).toMatchObject({ value: [{ id: "a" }], push: true });
    expect(reconcile("wh-deals", undefined, 0, undefined)).toBeNull();
  });

  it("takes whichever copy changed last", () => {
    const remote = { value: { maxBudget: 600 }, changedAt: 2000 };
    expect(reconcile("wh-settings", { maxBudget: 300 }, 3000, remote)).toEqual({ value: { maxBudget: 300 }, changedAt: 3000, push: true });
    expect(reconcile("wh-settings", { maxBudget: 300 }, 1000, remote)).toEqual({ value: { maxBudget: 600 }, changedAt: 2000, push: false });
    expect(reconcile("wh-settings", { maxBudget: 600 }, 2000, remote)).toBeNull();
  });

  it("combines watchlists and sales saved on two devices before syncing", () => {
    const remote = { value: { a: { itemId: "a" } }, changedAt: 2000 };
    const result = reconcile("wh-watchlist", { b: { itemId: "b" } }, 0, remote);
    expect(Object.keys(result.value).sort()).toEqual(["a", "b"]);
    expect(result.push).toBe(true);

    expect(combine("wh-deals", [{ id: "1" }, { id: "2" }], [{ id: "2" }, { id: "3" }]).map((d) => d.id)).toEqual(["2", "3", "1"]);
    // Settings aren't combined: the server's copy wins
    expect(combine("wh-settings", { a: 1 }, { b: 2 })).toEqual({ b: 2 });
  });
});
