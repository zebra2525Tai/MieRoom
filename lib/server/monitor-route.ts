import "server-only";
import { SYSTEM_ERROR_MESSAGE } from "@/lib/messages";
import { findActiveMonitor, loadMonitorScreen } from "./monitor";

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

/**
 * モニターが取りに行く入り口。合言葉が違う・無効なら、中身を何も返さず 404 (S91 の元)。
 * 返すのは、教室の状態だけ (予約の用途・申請者、先生の位置は読まない)。
 */
export async function monitorGet(passphrase: string): Promise<Response> {
  try {
    if ((await findActiveMonitor(passphrase)) === null) {
      return new Response(null, { status: 404, headers: HEADERS });
    }
    return Response.json(await loadMonitorScreen(), { headers: HEADERS });
  } catch (error) {
    console.error("monitor get failed", error);
    return Response.json(
      { message: SYSTEM_ERROR_MESSAGE },
      { status: 500, headers: HEADERS },
    );
  }
}
