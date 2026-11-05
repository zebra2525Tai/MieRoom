import { describe, expect, it } from "vitest";
import { config } from "@/proxy";

// The proxy sends people without a session to the sign-in screen, so the files the
// browser asks for on that screen (tab icons) must stay out of its matcher.
const source = config.matcher[0].source;
const matches = (path: string) => new RegExp(`^${source}$`).test(path);

describe("proxy matcher", () => {
  it("leaves the app icons alone, so they load before sign-in", () => {
    for (const path of ["/favicon.ico", "/icon.svg", "/apple-icon.png"]) {
      expect(matches(path), path).toBe(false);
    }
  });

  it("leaves Next.js static files alone", () => {
    expect(matches("/_next/static/chunks/app.js")).toBe(false);
    expect(matches("/_next/image")).toBe(false);
  });

  it("still covers pages and the sign-in screen", () => {
    for (const path of ["/", "/login", "/rooms", "/admin/masters/rooms"]) {
      expect(matches(path), path).toBe(true);
    }
  });
});
