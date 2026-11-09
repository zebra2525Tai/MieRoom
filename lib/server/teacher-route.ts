import type { NextRequest } from "next/server";
import { SYSTEM_ERROR_MESSAGE } from "@/lib/messages";
import { authorize, readJson } from "./action-request";
import { json } from "./admin-request";
import type { ReviewResult } from "./teacher-actions";
import type { CurrentUser } from "./session";

// The shape every operation of a 先生 shares: the site, the sign-in and the role are checked,
// the body is read, the work is done, and the answer carries only a short message.

function answer(result: ReviewResult): Response {
  switch (result.kind) {
    case "done":
      return json(200, { notice: result.notice });
    case "confirm":
      return json(409, { confirm: true, message: result.message });
    case "refused":
      return json(409, { message: result.message });
    case "not_found":
      return json(404, { message: SYSTEM_ERROR_MESSAGE });
  }
}

/** Runs `work` for a signed-in 先生 (or 時間割管理者). `label` is for the server's log only. */
export async function teacherPost(
  request: NextRequest,
  label: string,
  work: (
    user: CurrentUser,
    body: Record<string, unknown>,
  ) => Promise<ReviewResult | Response>,
): Promise<Response> {
  const allowed = await authorize(request, "teacher");
  if ("refusal" in allowed) return allowed.refusal;
  const body = await readJson(request);
  if (body instanceof Response) return body;
  const record =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  try {
    const result = await work(allowed.user, record);
    return result instanceof Response ? result : answer(result);
  } catch (error) {
    console.error(`${label} failed`, error);
    return json(500, { message: SYSTEM_ERROR_MESSAGE });
  }
}
