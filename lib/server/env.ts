import "server-only";
import { z } from "zod";
import { compileStudentPattern, parseDomainList } from "@/lib/auth/policy";

function isValidStudentPattern(value: string): boolean {
  try {
    compileStudentPattern(value);
    return true;
  } catch {
    return false;
  }
}

// Read lazily (on the first request, not at import time) so that `next build`
// works without real secrets, as in CI. A missing value fails closed with a
// clear message that names the variable but never prints any value.
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
  BETTER_AUTH_URL: z.url(),
  // Required on purpose: guessing a default here could open the login too wide.
  APP_ENV: z.enum(["production", "development"]),
  MICROSOFT_CLIENT_ID: z.string().min(1),
  MICROSOFT_CLIENT_SECRET: z.string().min(1),
  MICROSOFT_TENANT_ID: z.uuid(),
  ALLOWED_EMAIL_DOMAINS: z
    .string()
    .refine(
      (value) => parseDomainList(value).length > 0,
      "needs at least one domain",
    ),
  INITIAL_ADMIN_EMAIL: z.string().optional().default(""),
  // Optional. The shape of a student's e-mail before "@" (e.g. [0-9]{6}).
  // Unset: only the teacher list makes a teacher.
  STUDENT_EMAIL_PATTERN: z
    .string()
    .optional()
    .default("")
    .refine(
      isValidStudentPattern,
      "must be a valid pattern of at most 100 characters",
    ),
});

export type ServerEnv = Omit<
  z.infer<typeof schema>,
  "ALLOWED_EMAIL_DOMAINS" | "STUDENT_EMAIL_PATTERN"
> & {
  ALLOWED_EMAIL_DOMAINS: string[];
  /** null: not configured, so the teacher list decides. */
  STUDENT_EMAIL_PATTERN: RegExp | null;
};

let cached: ServerEnv | undefined;

export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const names = [
      ...new Set(parsed.error.issues.map((issue) => String(issue.path[0]))),
    ];
    throw new Error(
      `Invalid or missing environment variables: ${names.join(", ")}`,
    );
  }
  cached = {
    ...parsed.data,
    ALLOWED_EMAIL_DOMAINS: parseDomainList(parsed.data.ALLOWED_EMAIL_DOMAINS),
    STUDENT_EMAIL_PATTERN: compileStudentPattern(
      parsed.data.STUDENT_EMAIL_PATTERN,
    ),
  };
  return cached;
}
