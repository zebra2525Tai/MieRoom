import type { NextRequest } from "next/server";
import { SYSTEM_ERROR_MESSAGE } from "@/lib/messages";
import { json } from "@/lib/server/admin-request";
import { createProxyReservation } from "@/lib/server/teacher-actions";
import { teacherPost } from "@/lib/server/teacher-route";

// S12 「保存する」(代理入力): any 先生. Saved as approved, by the 先生 who is signed in.
export function POST(request: NextRequest): Promise<Response> {
  return teacherPost(request, "reservation proxy", async (user, body) => {
    const { confirmed, ...input } = body;
    const result = await createProxyReservation(
      user,
      input,
      confirmed === true,
      new Date(),
    );
    switch (result.kind) {
      case "created":
        return json(200, { id: result.id, notice: "MI204" });
      case "confirm":
        return json(409, { confirm: true, message: result.message });
      case "invalid":
        return json(400, { issues: result.issues });
      case "bad_request":
        return json(400, { message: SYSTEM_ERROR_MESSAGE });
    }
  });
}
