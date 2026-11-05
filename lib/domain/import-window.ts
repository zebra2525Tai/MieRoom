import { fiscalYearOfDate } from "./school-date";

// 取り込める月 (外部設計書 R3-3, R3-5). No I/O here.

export type MonthWindow = "past" | "open" | "closed" | "not-yet";

/** Months are "YYYY-MM"; today is a school date. */
export function monthWindow(today: string, month: string): MonthWindow {
  const thisMonth = today.slice(0, 7);
  if (month < thisMonth) return "past";
  if (month === thisMonth) {
    return Number(today.slice(8, 10)) >= 26 ? "closed" : "open";
  }
  return fiscalYearOfDate(`${month}-01`) > fiscalYearOfDate(today)
    ? "not-yet"
    : "open";
}
