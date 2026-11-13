import type { NextRequest } from "next/server";
import { adminPost } from "@/lib/server/admin-route";
import { setMonitorActive } from "@/lib/server/monitor";

// S27 無効にする / 有効に戻す。無効の URL は「URLが無効です」(S91) になる。時間割管理者だけ。
export function POST(request: NextRequest): Promise<Response> {
  return adminPost(request, "monitor active", (body) =>
    setMonitorActive(body.id, body.active),
  );
}
