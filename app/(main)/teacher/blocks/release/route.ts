import type { NextRequest } from "next/server";
import { MESSAGES } from "@/lib/messages";
import { json } from "@/lib/server/admin-request";
import { releaseBlock } from "@/lib/server/teacher-actions";
import { teacherPost } from "@/lib/server/teacher-route";

// S13 「解除」: any 先生.
export function POST(request: NextRequest): Promise<Response> {
  return teacherPost(request, "block release", async (_user, body) =>
    (await releaseBlock(body.id)) === "released"
      ? json(200, { notice: "MI302" })
      : json(404, { message: MESSAGES.ME902 }),
  );
}
