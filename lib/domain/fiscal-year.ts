import { TZDate } from "@date-fns/tz";

export const SCHOOL_TIME_ZONE = "Asia/Tokyo";

/**
 * 年度 (外部設計書 R2-2): 4〜12月はその年、1〜3月は前の年。
 * 日付の境目は日本時間で判定する (サーバーの時刻帯には頼らない)。
 */
export function fiscalYear(at: Date): number {
  const jst = new TZDate(at, SCHOOL_TIME_ZONE);
  return jst.getMonth() >= 3 ? jst.getFullYear() : jst.getFullYear() - 1;
}
