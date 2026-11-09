import type { NextRequest } from "next/server";
import { SYSTEM_ERROR_MESSAGE } from "@/lib/messages";
import { json } from "@/lib/server/admin-request";
import { createBlock } from "@/lib/server/teacher-actions";
import { teacherPost } from "@/lib/server/teacher-route";

// S13 「設定する」: any 先生. Reservations and lessons the block touches are counted, not changed.
export function POST(request: NextRequest): Promise<Response> {
  return teacherPost(request, "block create", async (user, body) => {
    const result = await createBlock(user, body, new Date());
    switch (result.kind) {
      case "created":
        return json(200, {
          notice: "MI301",
          reservations: result.reservations,
          lessons: result.lessons,
        });
      case "invalid":
        return json(400, { message: result.message });
      case "bad_request":
        return json(400, { message: SYSTEM_ERROR_MESSAGE });
    }
  });
}
