import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  determineRole,
  isFreshSession,
  isLoginPermitted,
  type Role,
} from "@/lib/auth/policy";
import { getAuth } from "./auth";
import { getDb } from "./db";
import { getEnv } from "./env";

// Data Access Layer for "who is signed in and what may they do".
// Every screen and every server function asks here, on every request, so a
// change to the allow list, the teacher list or the admin list applies from the
// next operation (外部設計書 3-1). Callers only ever receive this small object,
// never the session row or the e-mail address.
export type CurrentUser = {
  id: string;
  name: string;
  role: Role;
};

const RANK: Record<Role, number> = { student: 0, teacher: 1, admin: 2 };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;

  const env = getEnv();
  const db = getDb();
  const email = session.user.email.toLowerCase();

  // Anyone removed from the allow list (development) stops working at once,
  // even if their session is still valid.
  if (env.APP_ENV === "development") {
    const allowedEmails = (
      await db.allowedEmail.findMany({ select: { email: true } })
    ).map((row) => row.email);
    const permitted = isLoginPermitted({
      appEnv: env.APP_ENV,
      email,
      allowedEmails,
      initialAdminEmail: env.INITIAL_ADMIN_EMAIL,
    });
    if (!permitted) return null;
  }

  const [admins, teachers] = await Promise.all([
    db.adminEmail.findMany({ where: { email }, select: { email: true } }),
    db.teacher.findMany({
      where: { email, active: true },
      select: { email: true },
    }),
  ]);

  const role = determineRole({
    email,
    initialAdminEmail: env.INITIAL_ADMIN_EMAIL,
    adminEmails: admins.map((row) => row.email),
    activeTeacherEmails: teachers.flatMap((row) =>
      row.email ? [row.email] : [],
    ),
  });

  return { id: session.user.id, name: session.user.name, role };
});

/** For pages: send people who are not signed in to the login screen (S01). */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** True when the signed-in user has at least the given role. */
export function hasRole(user: CurrentUser, role: Role): boolean {
  return RANK[user.role] >= RANK[role];
}

export class ForbiddenError extends Error {
  constructor() {
    super("ME004");
    this.name = "ForbiddenError";
  }
}

/**
 * For server functions and route handlers: refuse (ME004) unless the user has
 * the role. Hiding a button is never enough; every operation calls this itself.
 */
export async function requireRole(role: Role): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError();
  if (!hasRole(user, role)) throw new ForbiddenError();
  return user;
}

/**
 * For the deletion screen (S26): the sign-in must be within the last 5 minutes.
 * Better Auth keeps session.createdAt fixed while a session is extended.
 */
export async function requireFreshSession(): Promise<void> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) throw new ForbiddenError();
  if (!isFreshSession(new Date(session.session.createdAt), new Date())) {
    throw new Error("ME006");
  }
}
