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
  ME004: "この操作をする権限がありません。",
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
