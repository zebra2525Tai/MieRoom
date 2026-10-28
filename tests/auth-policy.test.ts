import { describe, expect, it } from "vitest";
import {
  determineRole,
  evaluateMicrosoftProfile,
  isFreshSession,
  isLoginPermitted,
  parseDomainList,
  safeRedirectPath,
} from "@/lib/auth/policy";

const TENANT = "77ff3d48-a645-4053-91c5-38b2065afa37";
const config = {
  tenantId: TENANT,
  allowedDomains: ["school.onmicrosoft.com"],
};

describe("evaluateMicrosoftProfile (ME001: not a school account)", () => {
  it("accepts a member of the tenant with an allowed domain", () => {
    const result = evaluateMicrosoftProfile(
      { tid: TENANT, email: "Taro@School.onmicrosoft.com", oid: "o1" },
      config,
    );
    expect(result).toEqual({ ok: true, email: "taro@school.onmicrosoft.com" });
  });

  it("rejects another tenant even if the email looks right", () => {
    const result = evaluateMicrosoftProfile(
      {
        tid: "00000000-0000-0000-0000-000000000000",
        email: "a@school.onmicrosoft.com",
      },
      config,
    );
    expect(result).toEqual({ ok: false, code: "ME001" });
  });

  it("rejects a missing tid", () => {
    const result = evaluateMicrosoftProfile(
      { email: "a@school.onmicrosoft.com" },
      config,
    );
    expect(result).toEqual({ ok: false, code: "ME001" });
  });

  it("compares the tenant id case-insensitively", () => {
    const result = evaluateMicrosoftProfile(
      { tid: TENANT.toUpperCase(), email: "a@school.onmicrosoft.com" },
      config,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a domain that only ends with the allowed domain", () => {
    for (const email of [
      "a@evil-school.onmicrosoft.com",
      "a@sub.school.onmicrosoft.com",
      "a@school.onmicrosoft.com.evil.example",
    ]) {
      expect(evaluateMicrosoftProfile({ tid: TENANT, email }, config)).toEqual({
        ok: false,
        code: "ME001",
      });
    }
  });

  it("falls back to preferred_username when email is missing", () => {
    const result = evaluateMicrosoftProfile(
      { tid: TENANT, preferred_username: "hanako@school.onmicrosoft.com" },
      config,
    );
    expect(result).toEqual({
      ok: true,
      email: "hanako@school.onmicrosoft.com",
    });
  });

  it("rejects guest accounts (#EXT#) in either field", () => {
    const guestUpn = "bob_other.example#EXT#@school.onmicrosoft.com";
    expect(
      evaluateMicrosoftProfile(
        { tid: TENANT, preferred_username: guestUpn },
        config,
      ),
    ).toEqual({ ok: false, code: "ME001" });
    expect(
      evaluateMicrosoftProfile(
        { tid: TENANT, email: guestUpn.toLowerCase() },
        config,
      ),
    ).toEqual({ ok: false, code: "ME001" });
    expect(
      evaluateMicrosoftProfile(
        {
          tid: TENANT,
          email: "bob@school.onmicrosoft.com",
          preferred_username: guestUpn,
        },
        config,
      ),
    ).toEqual({ ok: false, code: "ME001" });
  });

  it("rejects when acct says the user is a guest", () => {
    const result = evaluateMicrosoftProfile(
      { tid: TENANT, email: "a@school.onmicrosoft.com", acct: 1 },
      config,
    );
    expect(result).toEqual({ ok: false, code: "ME001" });
  });

  it("rejects when no email can be determined", () => {
    expect(evaluateMicrosoftProfile({ tid: TENANT }, config)).toEqual({
      ok: false,
      code: "ME001",
    });
  });

  it("rejects malformed emails", () => {
    for (const email of [
      "",
      "no-at-sign",
      "a@@school.onmicrosoft.com",
      "a b@school.onmicrosoft.com",
      "@school.onmicrosoft.com",
    ]) {
      expect(evaluateMicrosoftProfile({ tid: TENANT, email }, config).ok).toBe(
        false,
      );
    }
  });

  it("fails closed when no allowed domain is configured", () => {
    const result = evaluateMicrosoftProfile(
      { tid: TENANT, email: "a@school.onmicrosoft.com" },
      { tenantId: TENANT, allowedDomains: [] },
    );
    expect(result).toEqual({ ok: false, code: "ME001" });
  });

  it("fails closed when no tenant id is configured", () => {
    const result = evaluateMicrosoftProfile(
      { tid: "", email: "a@school.onmicrosoft.com" },
      { tenantId: "", allowedDomains: ["school.onmicrosoft.com"] },
    );
    expect(result).toEqual({ ok: false, code: "ME001" });
  });

  it("ignores non-string claims", () => {
    const result = evaluateMicrosoftProfile(
      { tid: TENANT, email: { a: 1 }, preferred_username: ["x"] },
      config,
    );
    expect(result).toEqual({ ok: false, code: "ME001" });
  });
});

describe("isLoginPermitted (ME002: not on the allow list)", () => {
  const base = {
    email: "taro@school.onmicrosoft.com",
    allowedEmails: ["taro@school.onmicrosoft.com"],
    initialAdminEmail: "root@school.onmicrosoft.com",
  };

  it("production lets any verified school account in", () => {
    expect(
      isLoginPermitted({ ...base, appEnv: "production", allowedEmails: [] }),
    ).toBe(true);
  });

  it("development only lets allow-listed accounts in", () => {
    expect(isLoginPermitted({ ...base, appEnv: "development" })).toBe(true);
    expect(
      isLoginPermitted({
        ...base,
        appEnv: "development",
        email: "other@school.onmicrosoft.com",
      }),
    ).toBe(false);
  });

  it("development always lets the initial admin in", () => {
    expect(
      isLoginPermitted({
        ...base,
        appEnv: "development",
        email: "ROOT@school.onmicrosoft.com",
        allowedEmails: [],
      }),
    ).toBe(true);
  });

  it("an unset initial admin never matches an empty email", () => {
    expect(
      isLoginPermitted({
        ...base,
        appEnv: "development",
        email: "",
        initialAdminEmail: "",
      }),
    ).toBe(false);
  });

  it("matches case-insensitively", () => {
    expect(
      isLoginPermitted({
        ...base,
        appEnv: "development",
        email: "TARO@SCHOOL.ONMICROSOFT.COM",
      }),
    ).toBe(true);
  });
});

describe("determineRole", () => {
  const base = {
    initialAdminEmail: "root@school.onmicrosoft.com",
    adminEmails: ["boss@school.onmicrosoft.com"],
    activeTeacherEmails: ["teacher@school.onmicrosoft.com"],
  };

  it("is student by default", () => {
    expect(determineRole({ ...base, email: "s@school.onmicrosoft.com" })).toBe(
      "student",
    );
  });

  it("is teacher for an active teacher email", () => {
    expect(
      determineRole({ ...base, email: "Teacher@school.onmicrosoft.com" }),
    ).toBe("teacher");
  });

  it("is admin for the initial admin and for registered admins, even if also a teacher", () => {
    expect(
      determineRole({ ...base, email: "root@school.onmicrosoft.com" }),
    ).toBe("admin");
    expect(
      determineRole({ ...base, email: "boss@school.onmicrosoft.com" }),
    ).toBe("admin");
    expect(
      determineRole({
        ...base,
        email: "boss@school.onmicrosoft.com",
        activeTeacherEmails: ["boss@school.onmicrosoft.com"],
      }),
    ).toBe("admin");
  });

  it("does not make an empty email an admin when the initial admin is unset", () => {
    expect(determineRole({ ...base, initialAdminEmail: "", email: "" })).toBe(
      "student",
    );
  });
});

describe("safeRedirectPath", () => {
  it("keeps same-site paths", () => {
    expect(safeRedirectPath("/teacher/reservations?x=1#a")).toBe(
      "/teacher/reservations?x=1#a",
    );
    expect(safeRedirectPath("/")).toBe("/");
  });

  it("falls back for anything that could leave the site", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "evil.example",
      "/ok\n/evil",
      "/%0d%0aSet-Cookie:x=1",
      "",
      null,
      undefined,
    ]) {
      expect(safeRedirectPath(value as string | null | undefined)).toBe("/");
    }
  });

  it("never redirects back to the login page (avoids loops)", () => {
    expect(safeRedirectPath("/login")).toBe("/");
    expect(safeRedirectPath("/login?next=/x")).toBe("/");
  });

  it("uses the given fallback", () => {
    expect(safeRedirectPath("https://evil.example", "/home")).toBe("/home");
  });
});

describe("isFreshSession (re-authentication within 5 minutes)", () => {
  const now = new Date("2026-10-28T03:00:00Z");

  it("is fresh within 5 minutes of sign-in", () => {
    expect(isFreshSession(new Date("2026-10-28T02:56:00Z"), now)).toBe(true);
  });

  it("is stale at exactly 5 minutes and after", () => {
    expect(isFreshSession(new Date("2026-10-28T02:55:00Z"), now)).toBe(false);
    expect(isFreshSession(new Date("2026-10-28T02:00:00Z"), now)).toBe(false);
  });

  it("treats a future creation time as stale (clock skew is not trusted)", () => {
    expect(isFreshSession(new Date("2026-10-28T03:10:00Z"), now)).toBe(false);
  });

  it("treats an invalid date as stale", () => {
    expect(isFreshSession(new Date("nope"), now)).toBe(false);
  });
});

describe("parseDomainList", () => {
  it("splits, trims, lowercases and drops empties and @ prefixes", () => {
    expect(parseDomainList(" A.example , @b.example,,C.EXAMPLE ")).toEqual([
      "a.example",
      "b.example",
      "c.example",
    ]);
  });

  it("returns an empty list for undefined or empty", () => {
    expect(parseDomainList(undefined)).toEqual([]);
    expect(parseDomainList("")).toEqual([]);
  });
});
