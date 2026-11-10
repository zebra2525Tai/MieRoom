// 利用者に出すメッセージ(ID と文言)を、コードから取り出して JSON で書き出す。
// 使い方: tsx scripts/docs/messages.ts <出力先の JSON>
import { writeFileSync } from "node:fs";
import {
  LOGIN_ERROR_MESSAGES,
  MESSAGES,
  SYSTEM_ERROR_MESSAGE,
} from "../../lib/messages";

type Message = { id: string; text: string };

const out: Message[] = [];
// 文に値が入るメッセージは、○ を入れた形にする。
const fill = (fn: (...args: string[]) => string) =>
  fn(...Array.from({ length: fn.length }, () => "○"));

for (const [id, text] of Object.entries(LOGIN_ERROR_MESSAGES))
  out.push({ id, text });
for (const [id, value] of Object.entries(MESSAGES)) {
  out.push({
    id,
    text:
      typeof value === "function"
        ? fill(value as (...args: string[]) => string)
        : value,
  });
}
out.push({ id: "ME903", text: SYSTEM_ERROR_MESSAGE });

const rank: Record<string, number> = { ME: 0, MW: 1, MC: 2, MI: 3 };
const order = (id: string) =>
  (rank[id.slice(0, 2)] ?? 9) * 1e6 + Number(id.slice(2, 5));
out.sort((a, b) => order(a.id) - order(b.id) || a.id.localeCompare(b.id));

const target = process.argv[2];
if (!target) throw new Error("出力先を指定してください");
writeFileSync(target, JSON.stringify(out, null, 1));
console.log("messages:", out.length);
