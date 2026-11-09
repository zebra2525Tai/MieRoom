import type { NextRequest } from "next/server";
import { rejectReservation } from "@/lib/server/teacher-actions";
import { teacherPost } from "@/lib/server/teacher-route";

// S10・S11 「却下」: any 先生. The reason is told outside the system; none is kept.
export function POST(request: NextRequest): Promise<Response> {
  return teacherPost(request, "reservation reject", (user, body) =>
    rejectReservation(user, body.id, new Date()),
  );
}
