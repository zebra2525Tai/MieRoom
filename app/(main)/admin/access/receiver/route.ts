import type { NextRequest } from "next/server";
import { addReceiver } from "@/lib/server/access";
import { adminPost } from "@/lib/server/admin-route";

// S25 受信機: register an ID the gateway sends for a room. 時間割管理者 only.
export function POST(request: NextRequest): Promise<Response> {
  return adminPost(request, "receiver add", (body) =>
    addReceiver(body.roomId, body.receiverId),
  );
}
