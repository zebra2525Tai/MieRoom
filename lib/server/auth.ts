import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { evaluateMicrosoftProfile, isLoginPermitted } from "@/lib/auth/policy";
import { getDb } from "./db";
import { getEnv } from "./env";

const SESSION_SECONDS = 60 * 60 * 24 * 7; // 7 days (仮。外部設計書 3-4)
const SESSION_REFRESH_SECONDS = 60 * 60 * 24;

function createAuth() {
  const env = getEnv();
  const db = getDb();

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    // Only our own address may start or finish a login.
    trustedOrigins: [env.BETTER_AUTH_URL],
    database: prismaAdapter(db, { provider: "postgresql" }),
    advanced: {
      // UUIDs, so ids cannot be guessed or counted.
      // (A function, not the string "uuid": that one leaves the id to the database,
      // and our tables have no database default for it.)
      database: { generateId: () => crypto.randomUUID() },
      useSecureCookies: true,
      defaultCookieAttributes: {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
      },
    },
    session: {
      expiresIn: SESSION_SECONDS,
      updateAge: SESSION_REFRESH_SECONDS,
    },
    // Provider tokens are not needed after sign-in; if kept, keep them encrypted.
    account: {
      encryptOAuthTokens: true,
      // The sign-in "state" lives in an encrypted cookie, not in the database:
      // fewer queries on Neon's free plan and nothing to clean up.
      storeStateStrategy: "cookie",
    },
    socialProviders: {
      microsoft: {
        clientId: env.MICROSOFT_CLIENT_ID,
        clientSecret: env.MICROSOFT_CLIENT_SECRET,
        // One tenant (other tenants fail at Microsoft), or "organizations" when
        // MICROSOFT_ALLOWED_TENANT_IDS is set. In that case Microsoft lets any
        // organization reach us, so the tid check in validateUserInfo below is
        // what keeps everybody else out.
        tenantId: env.MICROSOFT_AUTHORITY,
        // Ask for sign-in information only (外部設計書 09章): no Graph access,
        // no refresh token, and no profile photo stored in our database.
        disableDefaultScope: true,
        scope: ["openid", "profile", "email"],
        disableProfilePhoto: true,
        // Work accounts often have no "email" claim; the user name is used instead.
        mapProfileToUser: (profile) => {
          const email = profile.email ?? profile.preferred_username;
          return typeof email === "string" ? { email } : {};
        },
      },
    },
    user: {
      // Runs on every Microsoft sign-in (new user, existing user, account link)
      // with the fresh claims, and fails closed.
      validateUserInfo: async ({ source }) => {
        if (
          source.method !== "oauth" ||
          source.oauth?.providerId !== "microsoft"
        ) {
          return { error: "ME003" };
        }
        const decision = evaluateMicrosoftProfile(source.oauth.profile ?? {}, {
          tenantIds: env.MICROSOFT_TENANT_IDS,
          allowedDomains: env.ALLOWED_EMAIL_DOMAINS,
        });
        if (!decision.ok) return { error: decision.code };

        const allowedEmails =
          env.APP_ENV === "development"
            ? (await db.allowedEmail.findMany({ select: { email: true } })).map(
                (row) => row.email,
              )
            : [];
        const permitted = isLoginPermitted({
          appEnv: env.APP_ENV,
          email: decision.email,
          allowedEmails,
          initialAdminEmail: env.INITIAL_ADMIN_EMAIL,
        });
        if (!permitted) return { error: "ME002" };
      },
    },
    // Errors that happen before we know where to go back to (a missing or wrong
    // state, for example) land on our own login screen, not on a built-in page.
    onAPIError: { errorURL: "/login" },
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { auth?: Auth };

export function getAuth(): Auth {
  if (!globalForAuth.auth) globalForAuth.auth = createAuth();
  return globalForAuth.auth;
}
