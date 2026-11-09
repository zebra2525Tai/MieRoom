import type { NextRequest } from "next/server";
import { MESSAGES, SYSTEM_ERROR_MESSAGE } from "@/lib/messages";
import { authorize, readJson } from "./action-request";
import { json } from "./admin-request";
import type { AccessResult } from "./access";

// The shape of every edit by a 時間割管理者 (S21〜S27): the site, the sign-in and the role are
// checked, the body is read, the work is done, and the answer is a short message.

export async function adminPost(
  request: NextRequest,
  label: string,
  work: (body: Record<string, unknown>) => Promise<AccessResult | Response>,
): Promise<Response> {
  const allowed = await authorize(request, "admin");
  if ("refusal" in allowed) return allowed.refusal;
  const body = await readJson(request);
  if (body instanceof Response) return body;
  const record =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  try {
    const result = await work(record);
    if (result instanceof Response) return result;
    switch (result.kind) {
      case "done":
        return json(200, { notice: result.notice });
      case "invalid":
        return json(400, { message: result.message });
      case "not_found":
        // The row is gone or never was: somebody else changed it first.
        return json(404, { message: MESSAGES.ME902 });
    }
  } catch (error) {
    console.error(`${label} failed`, error);
    return json(500, { message: SYSTEM_ERROR_MESSAGE });
  }
}
