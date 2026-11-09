import type { NextRequest } from "next/server";
import { adminPost } from "@/lib/server/admin-route";
import { removeLink } from "@/lib/server/links-edit";
import { linkResponse } from "@/lib/server/links-response";

// S22 削除 of one row: 時間割管理者 only. The screen asks first (MC504).
export function POST(request: NextRequest): Promise<Response> {
  return adminPost(request, "link remove", async (body) => {
    const { tab, ...input } = body;
    return linkResponse(await removeLink(tab, input, new Date()));
  });
}
