import type { NextRequest } from "next/server";
import { adminPost } from "@/lib/server/admin-route";
import { saveClosure } from "@/lib/server/closures-edit";
import { closureResponse } from "@/lib/server/closures-response";

// S23 追加・編集: 時間割管理者 only.
export function POST(request: NextRequest): Promise<Response> {
  return adminPost(request, "closure save", async (body) =>
    closureResponse(await saveClosure(body, new Date())),
  );
}
