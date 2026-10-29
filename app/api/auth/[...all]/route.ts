import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/server/auth";

// The auth object is created on the first request (not at import time),
// so `next build` does not need the real secrets.
export function GET(request: Request) {
  return toNextJsHandler(getAuth()).GET(request);
}

export function POST(request: Request) {
  return toNextJsHandler(getAuth()).POST(request);
}
