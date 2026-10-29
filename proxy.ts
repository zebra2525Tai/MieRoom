import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Two jobs, both before a page is rendered:
//  1. Content-Security-Policy with a fresh nonce on every request.
//  2. Send people without a session cookie to the login screen (S01).
//
// Job 2 is only a convenience (it checks that a cookie exists, not that it is
// valid). The real permission checks run on the server in lib/server/session.ts,
// inside each page and each server function.

// Places that have their own way to authenticate (合言葉つきURL, センサーの鍵, Cron の鍵)
// or must be reachable before signing in. /_dev is switched off by ENABLE_DEV_PAGES
// in its own layout, so it is a 404 wherever that is not "true" (◆3 H).
const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth",
  "/monitor",
  "/api/sensor",
  "/api/cron",
  "/_dev",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    // 'strict-dynamic' lets the nonce-approved scripts load the rest.
    // React needs eval only in development, for readable error stacks.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isPublic(pathname) && !getSessionCookie(request)) {
    const loginUrl = new URL("/login", request.url);
    // Only a path on this site can be remembered; anything else is dropped.
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    const redirect = NextResponse.redirect(loginUrl);
    redirect.headers.set("Cache-Control", "no-store");
    return redirect;
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Not for static files or prefetches; they need no CSP and no login.
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
