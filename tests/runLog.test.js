import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, expect, it } from "vitest";
import { setTestDatabase } from "@/lib/db";
import { lastRuns, noteRun } from "@/lib/runLog";

let pg;
beforeEach(() => {
  pg = new PGlite();
  setTestDatabase(async (text, params) => (await pg.query(text, params)).rows);
});
afterEach(() => setTestDatabase(null));

it("remembers when each scheduled job last ran", async () => {
  expect(await lastRuns()).toEqual({ alerts: null, harvest: null });
  await noteRun("alerts", new Date("2026-11-06T10:00:00Z"));
  await noteRun("alerts", new Date("2026-11-06T11:00:00Z"));
  expect(await lastRuns()).toEqual({ alerts: Date.parse("2026-11-06T11:00:00Z"), harvest: null });
});
