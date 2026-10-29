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
