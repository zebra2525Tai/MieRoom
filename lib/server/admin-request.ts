import type { NextRequest } from "next/server";
import { z } from "zod";
import { MESSAGES, SYSTEM_ERROR_MESSAGE } from "@/lib/messages";
import { MAX_FILES, MAX_TOTAL_BYTES } from "@/lib/domain/timetable-import";
import { fromThisSite } from "./same-site";
import { getCurrentUser, hasRole } from "./session";
import type { UploadedFile } from "./timetable-import";

// What every admin POST route (not a Server Action) checks first. A message is the only thing
// sent back on a refusal: no detail of the system.

export function json(status: number, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/** null when the request may go on. Order: same site, signed in, 時間割管理者. */
export async function refuseUnlessAdmin(
  request: NextRequest,
): Promise<Response | null> {
  if (!fromThisSite(request)) return json(403, { message: MESSAGES.ME004 });
  const user = await getCurrentUser();
  if (user === null) return json(401, { message: MESSAGES.ME004 });
  if (!hasRole(user, "admin")) return json(403, { message: MESSAGES.ME004 });
  return null;
}

/** The files of a multipart request (the field "files"), or the response to send back. */
export async function readUploads(
  request: NextRequest,
): Promise<UploadedFile[] | Response> {
  // The body is read into memory, so its size is checked before it is read.
  const length = request.headers.get("content-length");
  if (length === null || !/^\d+$/.test(length)) {
    return json(411, { message: SYSTEM_ERROR_MESSAGE });
  }
  if (Number(length) > MAX_TOTAL_BYTES + 256 * 1024) {
    return json(413, { message: MESSAGES.ME418 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { message: SYSTEM_ERROR_MESSAGE });
  }
  // More than 50 files is still read, so that the screen can say ME418 about it.
  const parsed = z
    .array(z.instanceof(File))
    .min(1)
    .max(MAX_FILES * 4)
    .safeParse(form.getAll("files"));
  if (!parsed.success) return json(400, { message: SYSTEM_ERROR_MESSAGE });
  return Promise.all(
    parsed.data.map(async (file) => ({
      name: file.name.slice(0, 200),
      bytes: new Uint8Array(await file.arrayBuffer()),
    })),
  );
}
