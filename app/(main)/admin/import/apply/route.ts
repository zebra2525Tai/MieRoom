import type { NextRequest } from "next/server";
import { SYSTEM_ERROR_MESSAGE } from "@/lib/messages";
import {
  json,
  readUploads,
  refuseUnlessAdmin,
} from "@/lib/server/admin-request";
import { runApply } from "@/lib/server/timetable-import";

// S20 「取り込む」: checks the files again, then writes all of them or none (R3-2).
export async function POST(request: NextRequest): Promise<Response> {
  const refused = await refuseUnlessAdmin(request);
  if (refused) return refused;
  const files = await readUploads(request);
  if (files instanceof Response) return files;
  try {
    return json(200, await runApply(files, new Date()));
  } catch (error) {
    console.error("timetable import failed", error);
    return json(500, { message: SYSTEM_ERROR_MESSAGE });
  }
}
