import type { NextRequest } from "next/server";
import { SYSTEM_ERROR_MESSAGE } from "@/lib/messages";
import { json } from "@/lib/server/admin-request";
import { authorize, readJson } from "@/lib/server/action-request";
import { withdrawReservation } from "@/lib/server/reservations";

// S07 「取り下げ」: the applicant only, while the request waits and has not started (ME110).
export async function POST(request: NextRequest): Promise<Response> {
  const allowed = await authorize(request, "student");
  if ("refusal" in allowed) return allowed.refusal;
  const body = await readJson(request);
  if (body instanceof Response) return body;
  const id =
    typeof body === "object" && body !== null && "id" in body
      ? (body as { id: unknown }).id
      : null;
  try {
    const result = await withdrawReservation(allowed.user, id, new Date());
    if (result.kind === "withdrawn") return json(200, { notice: "MI102" });
    if (result.kind === "refused")
      return json(409, { message: result.message });
    return json(404, { message: SYSTEM_ERROR_MESSAGE });
  } catch (error) {
    console.error("reservation withdraw failed", error);
    return json(500, { message: SYSTEM_ERROR_MESSAGE });
  }
}
