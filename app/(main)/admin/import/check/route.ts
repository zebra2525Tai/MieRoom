import type { NextRequest } from "next/server";
import { SYSTEM_ERROR_MESSAGE } from "@/lib/messages";
import {
  json,
  readUploads,
  refuseUnlessAdmin,
} from "@/lib/server/admin-request";
import { runCheck } from "@/lib/server/timetable-import";

// S20 「確認する」: reads the chosen files and answers for each one. Nothing is written.
export async function POST(request: NextRequest): Promise<Response> {
  const refused = await refuseUnlessAdmin(request);
  if (refused) return refused;
  const files = await readUploads(request);
  if (files instanceof Response) return files;
  try {
    return json(200, (await runCheck(files, new Date())).view);
  } catch (error) {
    console.error("timetable check failed", error);
    return json(500, { message: SYSTEM_ERROR_MESSAGE });
  }
}
