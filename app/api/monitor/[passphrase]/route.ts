import { monitorGet } from "@/lib/server/monitor-route";

// S30 モニターが、枠の境目ごとに取りに行く (1日13回)。ログインなし、合言葉つき。
// 合言葉が違う・無効なら、何も返さず 404。
export async function GET(
  _request: Request,
  context: { params: Promise<{ passphrase: string }> },
): Promise<Response> {
  const { passphrase } = await context.params;
  return monitorGet(passphrase);
}
