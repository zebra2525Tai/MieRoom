import type { NextRequest } from "next/server";
import { adminPost } from "@/lib/server/admin-route";
import { addLink } from "@/lib/server/links-edit";
import { linkResponse } from "@/lib/server/links-response";

// S22 追加: 時間割管理者 only. `tab` says which of the three tables.
export function POST(request: NextRequest): Promise<Response> {
  return adminPost(request, "link add", async (body) => {
    const { tab, ...input } = body;
    return linkResponse(await addLink(tab, input, new Date()));
  });
}
