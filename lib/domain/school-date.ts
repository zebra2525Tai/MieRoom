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

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function addMonths(month: string, count: number): string {
  const [year, value] = month.split("-").map(Number);
  const moved = new Date(Date.UTC(year, value - 1 + count, 1));
  return fromUtc(moved).slice(0, 7);
}

/** The weeks (Monday first) that cover a month, including days of the months beside it. */
export function monthWeeks(month: string): string[][] {
  const next = addMonths(month, 1);
  const weeks: string[][] = [];
  let monday = mondayOf(`${month}-01`);
  while (monday < `${next}-01`) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(monday, i)));
    monday = addDays(monday, 7);
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
