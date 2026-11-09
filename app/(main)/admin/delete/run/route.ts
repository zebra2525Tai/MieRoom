import type { NextRequest } from "next/server";
import {
  LOGIN_ERROR_MESSAGES,
  MESSAGES,
  SYSTEM_ERROR_MESSAGE,
} from "@/lib/messages";
import { authorize, readJson } from "@/lib/server/action-request";
import { json } from "@/lib/server/admin-request";
import { deleteMaster } from "@/lib/server/deletion";
import { hasFreshSession } from "@/lib/server/session";

// S26 「削除する」(R5-7): 時間割管理者 only, and only within 5 minutes of signing in again
// (ME006). The screen asks for the name first (MC502); the server checks it again.
export async function POST(request: NextRequest): Promise<Response> {
  const allowed = await authorize(request, "admin");
  if ("refusal" in allowed) return allowed.refusal;
  // The old sign-in is not enough for a deletion: the screen sends the person to sign in again.
  if (!(await hasFreshSession())) {
    return json(403, { message: LOGIN_ERROR_MESSAGES.ME006, reauth: true });
  }
  const body = await readJson(request);
  if (body instanceof Response) return body;
  const input =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  try {
    const result = await deleteMaster(
      input.kind,
      input.id,
      input.name,
      new Date(),
    );
    switch (result.kind) {
      case "deleted":
        return json(200, { notice: "MI503" });
      case "refused":
        return json(409, { message: result.message });
      case "not_found":
        return json(404, { message: MESSAGES.ME902 });
    }
  } catch (error) {
    console.error("master delete failed", error);
    return json(500, { message: SYSTEM_ERROR_MESSAGE });
  }
}
