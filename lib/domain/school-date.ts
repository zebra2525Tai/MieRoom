import { TZDate } from "@date-fns/tz";
import { SCHOOL_TIME_ZONE } from "./fiscal-year";

// Dates in the school's calendar, as "YYYY-MM-DD" strings (外部設計書 R2-1, 6-1).
// Arithmetic runs in UTC on the calendar date, so the server's time zone can never
// move a date by one day. Months are "YYYY-MM".

const WEEKDAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"] as const;

const pad = (value: number) => String(value).padStart(2, "0");

function toUtc(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUtc(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Today in Japan. Always from the server's clock (R2-3). */
export function schoolToday(now: Date): string {
  const jst = new TZDate(now, SCHOOL_TIME_ZONE);
  return `${jst.getFullYear()}-${pad(jst.getMonth() + 1)}-${pad(jst.getDate())}`;
}

/** 11/5 14:30 — a moment, in Japan time. */
export function schoolDateTimeText(at: Date): string {
  const jst = new TZDate(at, SCHOOL_TIME_ZONE);
  return `${jst.getMonth() + 1}/${jst.getDate()} ${jst.getHours()}:${pad(jst.getMinutes())}`;
}

/** Minutes since midnight in Japan. */
export function schoolMinutes(now: Date): number {
  const jst = new TZDate(now, SCHOOL_TIME_ZONE);
  return jst.getHours() * 60 + jst.getMinutes();
}

/** True for a date that really exists, written as YYYY-MM-DD. */
export function isSchoolDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  return fromUtc(toUtc(value)) === value;
}

/** A date column comes back as midnight UTC of that calendar date. */
export function dateColumnToText(value: Date): string {
  return fromUtc(value);
}

/** The value to store in a date column. */
export function textToDateColumn(date: string): Date {
  return toUtc(date);
}

export function addDays(date: string, days: number): string {
  const value = toUtc(date);
  value.setUTCDate(value.getUTCDate() + days);
  return fromUtc(value);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekdayOf(date: string): number {
  return toUtc(date).getUTCDay();
}

export function mondayOf(date: string): string {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

/**
 * The day a week starts on in S03 (時間割). Monday unless the person chose Sunday;
 * the choice only changes how weeks are shown, never a rule.
 */
export type WeekStart = "mon" | "sun";

/** "sun" stays Sunday; anything else (missing, unknown) is Monday. */
export function parseWeekStart(value: unknown): WeekStart {
  return value === "sun" ? "sun" : "mon";
}

/** The first day of the week that holds the date. */
export function weekStartOf(date: string, start: WeekStart = "mon"): string {
  return start === "sun" ? addDays(date, -weekdayOf(date)) : mondayOf(date);
}

/** The weekday names in the order of the week: 月〜日, or 日〜土. */
export function weekdayHeaders(start: WeekStart = "mon"): string[] {
  const order = start === "sun" ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0];
  return order.map((weekday) => WEEKDAY_NAMES[weekday]);
}

/**
 * The days S03 asks for in the week view: 月〜土 from Monday (Sunday is never part of
 * that week), 日〜土 from Sunday. The page then leaves out a weekend day with no lesson.
 */
export function weekDates(date: string, start: WeekStart = "mon"): string[] {
  const first = weekStartOf(date, start);
  const count = start === "sun" ? 7 : 6;
  return Array.from({ length: count }, (_, i) => addDays(first, i));
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function addMonths(month: string, count: number): string {
  const [year, value] = month.split("-").map(Number);
  const moved = new Date(Date.UTC(year, value - 1 + count, 1));
  return fromUtc(moved).slice(0, 7);
}

/**
 * The weeks that cover a month, including days of the months beside it. Each week
 * starts on Monday, or on Sunday when asked.
 */
export function monthWeeks(
  month: string,
  start: WeekStart = "mon",
): string[][] {
  const next = addMonths(month, 1);
  const weeks: string[][] = [];
  let first = weekStartOf(`${month}-01`, start);
  while (first < `${next}-01`) {
    const day = first;
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(day, i)));
    first = addDays(first, 7);
  }
  return weeks;
}

/** 年度 of a calendar date (R2-2). */
export function fiscalYearOfDate(date: string): number {
  const year = Number(date.slice(0, 4));
  return Number(date.slice(5, 7)) >= 4 ? year : year - 1;
}

/** 11/20(金). The year is added when it is not this year (6-1). */
export function formatDate(date: string, today: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const text = `${month}/${day}(${WEEKDAY_NAMES[weekdayOf(date)]})`;
  return date.slice(0, 4) === today.slice(0, 4) ? text : `${year}/${text}`;
}

/** Always with the year: 2026/11/20(金) */
export function formatLongDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}/${month}/${day}(${WEEKDAY_NAMES[weekdayOf(date)]})`;
}

export function formatMonth(month: string): string {
  const [year, value] = month.split("-").map(Number);
  return `${year}年${value}月`;
}
