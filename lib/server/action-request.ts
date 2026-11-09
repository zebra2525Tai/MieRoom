import type { NextRequest } from "next/server";
import {
  LOGIN_ERROR_MESSAGES,
  MESSAGES,
  SYSTEM_ERROR_MESSAGE,
} from "@/lib/messages";
import type { Role } from "@/lib/auth/policy";
import { json } from "./admin-request";
import { fromThisSite } from "./same-site";
import { getCurrentUser, hasRole, type CurrentUser } from "./session";

// What every route handler of a screen's operation checks first (予約, 使用止め): the request is
// from a page of this site, somebody is signed in, and the role is enough (3-1, 3-5).
// A refusal says only that; it gives no detail of the system.

const MAX_BODY_BYTES = 16 * 1024;

export async function authorize(
  request: NextRequest,
  role: Role,
): Promise<{ user: CurrentUser } | { refusal: Response }> {
  if (!fromThisSite(request)) {
    return { refusal: json(403, { message: MESSAGES.ME004 }) };
  }
  const user = await getCurrentUser();
  if (user === null) {
    return { refusal: json(401, { message: LOGIN_ERROR_MESSAGES.ME005 }) };
  }
  if (!hasRole(user, role)) {
    return { refusal: json(403, { message: MESSAGES.ME004 }) };
  }
  return { user };
}

/** The JSON body of a request, or the response to send back. The size is checked before reading. */
export async function readJson(
  request: NextRequest,
): Promise<unknown | Response> {
  const length = request.headers.get("content-length");
  if (length !== null && Number(length) > MAX_BODY_BYTES) {
    return json(413, { message: SYSTEM_ERROR_MESSAGE });
  }
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return json(413, { message: SYSTEM_ERROR_MESSAGE });
    }
    return JSON.parse(text);
  } catch {
    return json(400, { message: SYSTEM_ERROR_MESSAGE });
  }
}
