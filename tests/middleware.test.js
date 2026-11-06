import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { AUTH_COOKIE, passcodeToken } from "@/lib/passcode";

afterEach(() => {
  delete process.env.APP_PASSCODE;
});

const call = (path, headers = {}) => middleware(new NextRequest(`https://app.test${path}`, { headers }));

describe("passcode lock", () => {
  it("lets in the cookie, or the passcode as a Bearer header on API routes only", async () => {
    process.env.APP_PASSCODE = "open sesame";
    expect((await call("/api/scan")).status).toBe(401);
    expect((await call("/api/scan", { authorization: "Bearer wrong" })).status).toBe(401);
    expect((await call("/api/scan", { authorization: "Bearer open sesame" })).headers.get("x-middleware-next")).toBe("1");
    // Pages still need the cookie
    expect((await call("/", { authorization: "Bearer open sesame" })).status).toBe(307);
    const cookie = `${AUTH_COOKIE}=${await passcodeToken("open sesame")}`;
    expect((await call("/", { cookie })).headers.get("x-middleware-next")).toBe("1");
  });
});
