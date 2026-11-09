import type { NextRequest } from "next/server";
import { removeReceiver } from "@/lib/server/access";
import { adminPost } from "@/lib/server/admin-route";

// S25 受信機: take a registration away. 時間割管理者 only.
export function POST(request: NextRequest): Promise<Response> {
  return adminPost(request, "receiver remove", (body) =>
    removeReceiver(body.id),
  );
}
