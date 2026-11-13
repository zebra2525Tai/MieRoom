import type { NextRequest } from "next/server";
import { adminPost } from "@/lib/server/admin-route";
import { rotateMonitor } from "@/lib/server/monitor";

// S27 合言葉を変える (確認は MC503): 古い URL はすぐに使えなくなる。時間割管理者だけ。
export function POST(request: NextRequest): Promise<Response> {
  return adminPost(request, "monitor rotate", (body) => rotateMonitor(body.id));
}
