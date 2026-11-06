import type { NextRequest } from "next/server";
import { buildExport } from "@/lib/domain/master-export";
import {
  buildMasterZip,
  masterZipAsciiName,
  masterZipName,
} from "@/lib/domain/master-zip";
import { fiscalYearOfDate, schoolToday } from "@/lib/domain/school-date";
import { MESSAGES, SYSTEM_ERROR_MESSAGE } from "@/lib/messages";
import { loadExportSource } from "@/lib/server/queries/export";
import { fromThisSite } from "@/lib/server/same-site";
import { getCurrentUser, hasRole } from "@/lib/server/session";

// S24 の「8つのCSVを書き出す」。ZIP を返すので、画面ではなくここで受ける。
// 書き出す前の確認(R5-6)は、画面と同じ関数でここでもやり直す(画面の表示は信用しない)。

function text(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  // Another site must not be able to start this: the form comes from this site only.
  if (!fromThisSite(request)) return text(403, MESSAGES.ME004);

  const user = await getCurrentUser();
  if (user === null) return text(401, MESSAGES.ME004);
  if (!hasRole(user, "admin")) return text(403, MESSAGES.ME004);

  try {
    const now = new Date();
    const today = schoolToday(now);
    const result = buildExport(await loadExportSource(fiscalYearOfDate(today)));
    if (result.files === null) {
      const count = result.issues.filter(
        (issue) => issue.level === "error",
      ).length;
      return text(409, MESSAGES.ME510(count));
    }
    const zip = buildMasterZip(result.files, now);
    return new Response(new Blob([new Uint8Array(zip)]), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${masterZipAsciiName(today)}"; filename*=UTF-8''${encodeURIComponent(masterZipName(today))}`,
        "Content-Length": String(zip.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    // Details stay in the server log; the person sees ME903 only.
    console.error("master export failed", error);
    return text(500, SYSTEM_ERROR_MESSAGE);
  }
}
