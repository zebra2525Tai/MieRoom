import type { NextRequest } from "next/server";
import { setTagId } from "@/lib/server/access";
import { adminPost } from "@/lib/server/admin-route";

// S25 タグ: set, change or remove (an empty tagId) the タグID of a 講師. 時間割管理者 only.
export function POST(request: NextRequest): Promise<Response> {
  return adminPost(request, "tag save", (body) =>
    setTagId(body.teacherId, body.tagId ?? null),
  );
}
