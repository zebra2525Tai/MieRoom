import type { NextRequest } from "next/server";
import { adminPost } from "@/lib/server/admin-route";
import { saveMaster } from "@/lib/server/master-edit";
import { masterResponse } from "@/lib/server/master-response";

// S21 追加・編集 (クラス・講師・教科・教室): 時間割管理者 only. `kind` says which master.
export function POST(request: NextRequest): Promise<Response> {
  return adminPost(request, "master save", async (body) => {
    const { kind, ...input } = body;
    return masterResponse(await saveMaster(kind, input, new Date()));
  });
}
