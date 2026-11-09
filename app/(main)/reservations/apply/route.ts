import type { NextRequest } from "next/server";
import { SYSTEM_ERROR_MESSAGE } from "@/lib/messages";
import { json } from "@/lib/server/admin-request";
import { authorize, readJson } from "@/lib/server/action-request";
import { createReservation } from "@/lib/server/reservations";

// S06 「申請する」: anybody signed in. The rules are checked again here (R4-2〜R4-5).
export async function POST(request: NextRequest): Promise<Response> {
  const allowed = await authorize(request, "student");
  if ("refusal" in allowed) return allowed.refusal;
  const body = await readJson(request);
  if (body instanceof Response) return body;
  try {
    const result = await createReservation(allowed.user, body, new Date());
    if (result.kind === "created") {
      return json(200, { id: result.id, notice: "MI101" });
    }
    if (result.kind === "invalid") return json(400, { issues: result.issues });
    return json(400, { message: SYSTEM_ERROR_MESSAGE });
  } catch (error) {
    console.error("reservation apply failed", error);
    return json(500, { message: SYSTEM_ERROR_MESSAGE });
  }
}
