import type { NextRequest } from "next/server";
import { approveReservation } from "@/lib/server/teacher-actions";
import { teacherPost } from "@/lib/server/teacher-route";

// S10・S11 「承認」: any 先生. `confirmed` is the answer to MC201.
export function POST(request: NextRequest): Promise<Response> {
  return teacherPost(request, "reservation approve", (user, body) =>
    approveReservation(user, body.id, body.confirmed === true, new Date()),
  );
}
