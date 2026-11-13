import type { NextRequest } from "next/server";
import { adminPost } from "@/lib/server/admin-route";
import { addMonitor } from "@/lib/server/monitor";

// S27 追加: 名前を入れると、合言葉を作って URL を出す。時間割管理者だけ。
export function POST(request: NextRequest): Promise<Response> {
  return adminPost(request, "monitor add", (body) => addMonitor(body.name));
}
