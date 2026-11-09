import type { NextRequest } from "next/server";
import { adminPost } from "@/lib/server/admin-route";
import { setMasterActive } from "@/lib/server/master-edit";
import { masterResponse } from "@/lib/server/master-response";

// S21 無効にする / 有効に戻す: 時間割管理者 only. Deleting is S26, not here.
export function POST(request: NextRequest): Promise<Response> {
  return adminPost(request, "master active", async (body) =>
    masterResponse(
      await setMasterActive(body.kind, body.id, body.active, new Date()),
    ),
  );
}
