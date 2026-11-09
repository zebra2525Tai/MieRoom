import type { NextRequest } from "next/server";
import { cancelReservation } from "@/lib/server/teacher-actions";
import { teacherPost } from "@/lib/server/teacher-route";

// S11 「取消」: any 先生 (not a student), only before the first slot starts.
export function POST(request: NextRequest): Promise<Response> {
  return teacherPost(request, "reservation cancel", (user, body) =>
    cancelReservation(user, body.id, new Date()),
  );
}
