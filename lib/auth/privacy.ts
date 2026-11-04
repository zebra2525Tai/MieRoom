// What we refuse to keep from a sign-in (外部設計書 12章 個人情報).
// Pure functions, so they can be tested without Better Auth or a database.
// lib/server/auth.ts applies them just before Better Auth writes a row.

/** The fields of a session row that identify a person's device or network. */
export function sessionTrackingFields(): { ipAddress: null; userAgent: null } {
  return { ipAddress: null, userAgent: null };
}

/**
 * The fields of an account row that hold what Microsoft handed us at sign-in.
 * The ID token is a signed JWT with the name, e-mail and ids inside, and
 * Better Auth stores it as is. None of it is needed after the sign-in has been
 * checked, so none of it is kept.
 */
export function providerCredentialFields(): {
  accessToken: null;
  refreshToken: null;
  idToken: null;
  accessTokenExpiresAt: null;
  refreshTokenExpiresAt: null;
} {
  return {
    accessToken: null,
    refreshToken: null,
    idToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
  };
}
