// Message texts from 外部設計書 10章 (メッセージ一覧). Keep the ids and wording in sync with Notion.

export const LOGIN_ERROR_MESSAGES = {
  ME001:
    "学校のアカウントではないため、ログインできません。学校のMicrosoftアカウントでログインしてください。",
  ME002:
    "このアカウントは、利用が許可されていません。時間割管理者に連絡してください。",
  ME003: "ログインに失敗しました。もう一度お試しください。",
  ME005: "ログインの有効期限が切れました。もう一度ログインしてください。",
} as const;

export type LoginErrorId = keyof typeof LOGIN_ERROR_MESSAGES;

export const MESSAGES = {
  MI001: "自分のクラスを選んでください。",
  MI002: "年度が替わりました。自分のクラスを選び直してください。",
  MI003: "いまは授業がありません。",
  MW001: (classes: string) =>
    `時間割が未定のクラスがあるため、空きが変わることがあります(未入力: ${classes})。`,
  ME101: (slotDate: string, deadlineDate: string) =>
    `申請の締め切りを過ぎています(${slotDate}の枠は、${deadlineDate} 12:00まで)。`,
  ME102: (lastDate: string) => `申請できるのは、30日先(${lastDate})までです。`,
  ME103: "過ぎた枠は申請できません。",
  // 時間割の取り込み (10章 ME401〜ME419, MW401, MI401)
  ME401: "CSVとして読めません(文字コードはUTF-8にしてください)。",
  ME402: (columns: string) => `必要な列がありません(${columns})。`,
  ME403:
    "1つのファイルに、複数のクラス(または対象年月・最終入力日)が入っています。",
  ME404: (a: string, b: string) =>
    `同じクラス・同じ月のファイルが、2つ選ばれています(${a}、${b})。`,
  ME405: (year: number, month: number) =>
    `過去の月は取り込めません(${year}年${month}月)。`,
  ME406:
    "新しい年度の時間割は、新しい年度になってから(4月1日から)取り込めます。",
  ME407: (month: number) =>
    `${month}月の取り込みは締め切りました(26日の0時)。必要なら、例外解除をしてください。`,
  ME408: (className: string, year: number) =>
    `クラス「${className}」は、${year}年度には存在しません。`,
  ME409: (value: string, kind: string, line: number) =>
    `「${value}」が${kind}マスタにありません(${line}行目)。名前が変更された可能性があります。最新のマスタCSVを取り込んでから、出し直してください。`,
  ME410: (csv: string, master: string) =>
    `ホームルーム教室が、クラスマスタと違います(CSV: ${csv}、マスタ: ${master})。最新のマスタCSVを取り込んでから、出し直してください。`,
  ME411: (date: string) =>
    `当月の最終入力日が月末ではありません(${date})。月の最後まで入力してから、出し直してください。`,
  ME412: (dates: string) =>
    `授業も名目もない平日があります(${dates})。最新のマスタCSVを取り込むか、設定シートの休み・行事に名目を入れてから、出し直してください。`,
  ME413: (line: number) =>
    `「外部講師」は使えません。「各担当」にしてください(${line}行目)。`,
  ME414: (line: number, column: string, value: string) =>
    `値の形式が正しくありません(${line}行目、${column}列: ${value})。`,
  ME415: (line: number) =>
    `同じ日・同じ開始時刻の授業が2つあります(${line}行目)。`,
  ME416: (line: number) => `開始時刻が、終了時刻より後です(${line}行目)。`,
  ME417: (line: number) =>
    `日付が、対象月(と翌月11日まで)の範囲の外です(${line}行目)。`,
  ME418: "ファイルが大きすぎます(または数が多すぎます)。",
  ME419: (line: number) =>
    `授業の時刻が、時限と合いません(${line}行目)。授業は時限単位で入力してください(ツールの設定シートの時限の時刻も確かめてください)。`,
  MW401: (kind: string, value: string, line: number) =>
    `無効になっている${kind}「${value}」が使われています(${line}行目)。`,
  MI401: "3月のファイルの4月の部分は、取り込みません。",
  MI402: (month: number, classes: number, lessons: number) =>
    `取り込みました(${month}月: ${classes}クラス、授業${lessons}件)。`,
  MW703: (count: number) =>
    `システムで変更した授業が${count}件あります。取り込むと、変更は失われます。`,
  MC401: (count: number) =>
    `${count}件のファイルを取り込みます。同じクラス・同じ月の時間割は、入れ替わります。よろしいですか。`,
  MC402: (className: string, month: number) =>
    `${className}の${month}月の締めを、例外で解除しますか。1回取り込むと、自動で締め直します。`,
  MC701: (count: number) =>
    `取り込むと、システムでの変更${count}件が失われます。よろしいですか。`,
  ME004: "この操作をする権限がありません。",
  ME901:
    "データを読み込めませんでした。通信を確認して、もう一度お試しください。",
  ME510: (count: number) =>
    `書き出し前の確認で、直す必要があるものがあります(${count}件)。直してから書き出してください。`,
  MW503: (count: number) =>
    `休み・行事が180行を超えています(${count}行)。ツールの上限は、担任が手で足した行も含めて200行です。`,
  MW504: (year: number) =>
    `${year}年度に、全校の休み・行事が1件もありません(予約の締め切りの判定に使います)。`,
} as const;

export const SYSTEM_ERROR_MESSAGE =
  "システムでエラーが起きました。時間をおいて、もう一度お試しください。"; // ME903

/** Unknown or missing codes are shown as a plain login failure (ME003), never echoed back. */
export function loginErrorMessage(code: string | undefined): string | null {
  if (code === undefined || code === "") return null;
  if (Object.hasOwn(LOGIN_ERROR_MESSAGES, code)) {
    return LOGIN_ERROR_MESSAGES[code as LoginErrorId];
  }
  return LOGIN_ERROR_MESSAGES.ME003;
}
