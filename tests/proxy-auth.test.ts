import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

const BASE = "https://example.test";
const call = (
  path: string,
  init: ConstructorParameters<typeof NextRequest>[1] = {},
) => proxy(new NextRequest(`${BASE}${path}`, init));
const SIGNED_IN = { cookie: "better-auth.session_token=abc.def" };

describe("proxy without a session", () => {
  it("sends a page request to the sign-in screen and remembers the path", () => {
    const response = call("/admin/import?tab=1");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      `${BASE}/login?next=%2Fadmin%2Fimport%3Ftab%3D1`,
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 401 with the expiry message (ME005) to anything that is not a GET", async () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const response = call("/admin/import/check", { method });
      expect(response.status, method).toBe(401);
      expect(response.headers.get("location"), method).toBeNull();
      expect(response.headers.get("cache-control"), method).toBe("no-store");
      expect(await response.json(), method).toEqual({
        message:
          "ログインの有効期限が切れました。もう一度ログインしてください。",
      });
    }
  });

  it("does not reveal the system in a refusal", async () => {
    const response = call("/admin/export/download", { method: "POST" });
    const text = await response.text();
    expect(text).not.toMatch(/stack|prisma|database|neon/i);
  });

  it("leaves the places with their own authentication alone", () => {
    for (const path of [
      "/login",
      "/api/auth/sign-in/social",
      "/api/gateway/location-events",
      "/monitor/abc",
      "/robots.txt",
    ]) {
      const response = call(path, { method: "POST" });
      expect(response.status, path).toBe(200);
      expect(response.headers.get("x-middleware-next"), path).toBe("1");
    }
  });
});

describe("proxy with a session cookie", () => {
  it("lets pages and posts through (the real check is in each server function)", () => {
    for (const method of ["GET", "POST"]) {
      const response = call("/admin/import/check", {
        method,
        headers: SIGNED_IN,
      });
      expect(response.status, method).toBe(200);
      expect(response.headers.get("x-middleware-next"), method).toBe("1");
      expect(response.headers.get("content-security-policy")).toContain(
        "nonce-",
      );
    }
  });
});
