import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    // Tests that start an in-memory Postgres (PGlite) or make push keys take
    // a few seconds each, and longer when every test file runs at once
    testTimeout: 20_000,
  },
});
