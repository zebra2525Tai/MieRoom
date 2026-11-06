import type { NextRequest } from "next/server";
import { z } from "zod";
import { SYSTEM_ERROR_MESSAGE } from "@/lib/messages";
import { json, refuseUnlessAdmin } from "@/lib/server/admin-request";
import { unlockException } from "@/lib/server/timetable-import";

const input = z.object({
  classId: z.uuid(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

// S20 「例外解除」(R3-5): lets one class import its month after the closing day, once.
export async function POST(request: NextRequest): Promise<Response> {
  const refused = await refuseUnlessAdmin(request);
  if (refused) return refused;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { message: SYSTEM_ERROR_MESSAGE });
  }
  const parsed = input.safeParse({
    classId: form.get("classId"),
    month: form.get("month"),
  });
  if (!parsed.success) return json(400, { message: SYSTEM_ERROR_MESSAGE });
  try {
    const result = await unlockException(
      parsed.data.classId,
      parsed.data.month,
      new Date(),
    );
    return result === "unlocked"
      ? json(200, { ok: true })
      : json(400, { message: SYSTEM_ERROR_MESSAGE });
  } catch (error) {
    console.error("unlock failed", error);
    return json(500, { message: SYSTEM_ERROR_MESSAGE });
  }
}
