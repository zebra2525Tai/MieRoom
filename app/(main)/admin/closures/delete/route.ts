import type { NextRequest } from "next/server";
import { adminPost } from "@/lib/server/admin-route";
import { deleteClosure } from "@/lib/server/closures-edit";
import { closureResponse } from "@/lib/server/closures-response";

// S23 削除: 時間割管理者 only. Only a row made in the system; the screen asks first.
export function POST(request: NextRequest): Promise<Response> {
  return adminPost(request, "closure delete", async (body) =>
    closureResponse(await deleteClosure(body.id, new Date())),
  );
}
