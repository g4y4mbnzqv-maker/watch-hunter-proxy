import { describe, expect, it } from "vitest";
import { refusal } from "@/lib/cronAuth";

describe("harvest route secret check", () => {
  it("lets Vercel Cron in, ignoring spaces pasted with the secret", () => {
    expect(refusal("abc123", "Bearer abc123")).toBeNull();
    expect(refusal(" abc123\n", "Bearer abc123")).toBeNull();
  });

  it("says why it refused", () => {
    expect(refusal(undefined, "Bearer abc123")).toMatch(/isn't set/);
    expect(refusal("  ", "Bearer abc123")).toMatch(/isn't set/);
    expect(refusal("abc123", null)).toMatch(/no Authorization header/);
    expect(refusal("abc123", "Bearer wrong")).toMatch(/doesn't match/);
  });
});
