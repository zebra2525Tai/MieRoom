import { describe, expect, it } from "vitest";
import {
  providerCredentialFields,
  sessionTrackingFields,
} from "@/lib/auth/privacy";

describe("sessionTrackingFields", () => {
  it("empties the IP address and the browser information", () => {
    expect(sessionTrackingFields()).toEqual({
      ipAddress: null,
      userAgent: null,
    });
  });

  it("does not touch the columns the session needs", () => {
    const keys = Object.keys(sessionTrackingFields());
    for (const needed of ["token", "expiresAt", "userId", "createdAt"]) {
      expect(keys).not.toContain(needed);
    }
  });
});

describe("providerCredentialFields", () => {
  it("empties every token and its expiry, including the ID token", () => {
    expect(providerCredentialFields()).toEqual({
      accessToken: null,
      refreshToken: null,
      idToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
    });
  });

  it("does not touch the columns that identify the account", () => {
    const keys = Object.keys(providerCredentialFields());
    for (const needed of ["accountId", "providerId", "userId", "scope"]) {
      expect(keys).not.toContain(needed);
    }
  });

  it("merges over a row the way Better Auth applies a hook result", () => {
    const row = {
      accountId: "oid-1",
      providerId: "microsoft",
      userId: "u1",
      idToken: "eyJ.header.payload",
      accessToken: "secret",
    };
    const merged = { ...row, ...providerCredentialFields() };
    expect(merged.accountId).toBe("oid-1");
    expect(merged.providerId).toBe("microsoft");
    expect(merged.idToken).toBeNull();
    expect(merged.accessToken).toBeNull();
  });
});
