import type { NextRequest } from "next/server";

/**
 * Is the request from a page of this site? The browser sets Sec-Fetch-Site and a page
 * cannot change it. Origin is not enough: with Referrer-Policy no-referrer (set for the
 * whole site) a form on this site sends "Origin: null". Origin is the fallback for a
 * browser that sends no Sec-Fetch-Site.
 */
export function fromThisSite(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null) return site === "same-origin";
  const origin = request.headers.get("origin");
  if (origin === null) return false;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}
