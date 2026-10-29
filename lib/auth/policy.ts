// Pure rules for login and roles (外部設計書 03章 / 09章 IF02 / R5-7).
// No I/O here, so every rule can be tested without a database or Microsoft.

export type Role = "student" | "teacher" | "admin";
export type AppEnv = "production" | "development";

/** Message ids from 外部設計書 10章. */
export type LoginErrorCode = "ME001" | "ME002" | "ME003" | "ME005";

export type MicrosoftLoginConfig = {
  /** Tenant ids (tid) whose accounts may sign in. Empty: nobody. */
  tenantIds: string[];
  allowedDomains: string[];
};

export type ProfileDecision =
  { ok: true; email: string } | { ok: false; code: "ME001" };

const REJECT: ProfileDecision = { ok: false, code: "ME001" };

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Exactly one "@", something on both sides, no whitespace or control characters. */
function isPlainEmail(value: string): boolean {
  if (/[\s\u0000-\u001f\u007f]/.test(value)) return false;
  const parts = value.split("@");
  return parts.length === 2 && parts[0] !== "" && parts[1] !== "";
}

function isGuestName(value: string | undefined): boolean {
  return value !== undefined && value.toLowerCase().includes("#ext#");
}

/**
 * Decides whether a Microsoft profile belongs to the school.
 * Both the tenant id (tid, one of the allowed tenants) and the e-mail domain must
 * match, guests are refused,
 * and everything fails closed (missing config, missing or odd claims).
 *
 * The e-mail is a value the tenant admin can set, so it is never trusted
 * on its own: the tid check is what proves the account is from our tenant.
 */
export function evaluateMicrosoftProfile(
  profile: Record<string, unknown>,
  config: MicrosoftLoginConfig,
): ProfileDecision {
  const expectedTenants = config.tenantIds
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item !== "");
  if (expectedTenants.length === 0 || config.allowedDomains.length === 0)
    return REJECT;

  const tid = asString(profile.tid)?.trim().toLowerCase();
  if (tid === undefined || !expectedTenants.includes(tid)) return REJECT;

  const emailClaim = asString(profile.email);
  const upn = asString(profile.preferred_username);

  // A guest invited into the school tenant has the school's tid and an
  // "name_other.example#EXT#@school..." user name, so check every source.
  if (profile.acct === 1) return REJECT;
  if (isGuestName(emailClaim) || isGuestName(upn)) return REJECT;

  const raw = emailClaim ?? upn;
  if (raw === undefined) return REJECT;
  const email = normalizeEmail(raw);
  if (!isPlainEmail(email)) return REJECT;

  const domain = email.split("@")[1];
  if (!config.allowedDomains.includes(domain)) return REJECT;

  return { ok: true, email };
}

/** " AAA , bbb,, " -> ["aaa", "bbb"] (tenant ids, lower case) */
export function parseTenantIdList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item !== "");
}

/** "a.example, @B.example" -> ["a.example", "b.example"] */
export function parseDomainList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase().replace(/^@/, ""))
    .filter((item) => item !== "");
}

/**
 * Production lets every verified school account in (they are registered as students).
 * Development only lets people on the allow list in, so that the shared
 * development database holds just the developers' own accounts.
 * The initial admin is always allowed so nobody is locked out.
 */
export function isLoginPermitted(input: {
  appEnv: AppEnv;
  email: string;
  allowedEmails: string[];
  initialAdminEmail: string;
}): boolean {
  if (input.appEnv === "production") return true;
  const email = normalizeEmail(input.email);
  if (email === "") return false;
  if (email === normalizeEmail(input.initialAdminEmail)) return true;
  return input.allowedEmails.some((item) => normalizeEmail(item) === email);
}

const MAX_PATTERN_LENGTH = 100;

/**
 * The shape of a student's e-mail (the part before "@"), e.g. "[0-9]{6}" for a
 * six-digit student number. It comes from STUDENT_EMAIL_PATTERN, so the school's
 * format never has to be written in the code.
 *
 * Returns null when nothing is configured (the feature is off). The pattern is
 * wrapped so it must match the whole part, and an alternation like "a|b" cannot
 * escape the anchors. Throws on an invalid or oversized pattern.
 */
export function compileStudentPattern(
  value: string | undefined,
): RegExp | null {
  const source = (value ?? "").trim();
  if (source === "") return null;
  if (source.length > MAX_PATTERN_LENGTH) {
    throw new Error("STUDENT_EMAIL_PATTERN is too long");
  }
  return new RegExp(`^(?:${source})$`);
}

/**
 * Admin > teacher > student, judged from the verified e-mail on every request.
 *
 * With a student pattern: an address that fits it is a student, every other
 * school address is a teacher, and the student number can never be promoted
 * (by the teacher list). Admins are never made automatically: only
 * INITIAL_ADMIN_EMAIL and the registered admins.
 * Without a pattern: only the active teacher list makes a teacher.
 */
export function determineRole(input: {
  email: string;
  initialAdminEmail: string;
  adminEmails: string[];
  activeTeacherEmails: string[];
  studentEmailPattern?: RegExp | null;
}): Role {
  const email = normalizeEmail(input.email);
  if (email === "") return "student";
  const initialAdmin = normalizeEmail(input.initialAdminEmail);
  if (initialAdmin !== "" && email === initialAdmin) return "admin";
  if (input.adminEmails.some((item) => normalizeEmail(item) === email))
    return "admin";

  const pattern = input.studentEmailPattern;
  if (pattern) {
    const localPart = email.split("@")[0];
    return pattern.test(localPart) ? "student" : "teacher";
  }

  if (
    input.activeTeacherEmails.some((item) => normalizeEmail(item) === email)
  ) {
    return "teacher";
  }
  return "student";
}

/** Only same-site paths are allowed as a place to return to after login. */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (typeof value !== "string" || value === "") return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/%0d|%0a|%00/i.test(value)) return fallback;
  if (
    value === "/login" ||
    value.startsWith("/login?") ||
    value.startsWith("/login/")
  ) {
    return fallback;
  }
  return value;
}

export const REAUTH_WINDOW_MS = 5 * 60 * 1000;

/**
 * Re-authentication (削除管理 S26): the session must have been created
 * within the last 5 minutes. The session's createdAt does not move when the
 * session is extended, so it tells when the person really signed in.
 */
export function isFreshSession(createdAt: Date, now: Date): boolean {
  const created = createdAt.getTime();
  if (Number.isNaN(created)) return false;
  const age = now.getTime() - created;
  return age >= 0 && age < REAUTH_WINDOW_MS;
}
