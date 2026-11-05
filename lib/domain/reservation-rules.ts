import { addDays, schoolMinutes, schoolToday, weekdayOf } from "./school-date";

// 申請できる範囲と締め切り (外部設計書 R4-2, R4-3). No I/O here.

/** A closure for the whole school. Closures of one class do not change 営業日. */
export type SchoolClosure = { startDate: string; endDate: string | null };

export const APPLICATION_WINDOW_DAYS = 30;
const DEADLINE_MINUTES = 12 * 60;

/** 営業日: not Saturday or Sunday, and not a day of a whole-school closure. */
export function isBusinessDay(
  date: string,
  closures: readonly SchoolClosure[],
): boolean {
  const weekday = weekdayOf(date);
  if (weekday === 0 || weekday === 6) return false;
  return !closures.some(
    (closure) =>
      date >= closure.startDate &&
      date <= (closure.endDate ?? closure.startDate),
  );
}

export function previousBusinessDay(
  date: string,
  closures: readonly SchoolClosure[],
): string {
  let day = addDays(date, -1);
  while (!isBusinessDay(day, closures)) day = addDays(day, -1);
  return day;
}

export type ApplicationCheck =
  | { ok: true; deadlineDate: string }
  | { ok: false; code: "ME101" | "ME102" | "ME103"; deadlineDate: string };

/** Whether a slot on this date can be applied for right now. */
export function checkApplicationDate(
  date: string,
  now: Date,
  closures: readonly SchoolClosure[],
): ApplicationCheck {
  const today = schoolToday(now);
  const deadlineDate = previousBusinessDay(date, closures);
  if (date < today) return { ok: false, code: "ME103", deadlineDate };
  if (date > addDays(today, APPLICATION_WINDOW_DAYS)) {
    return { ok: false, code: "ME102", deadlineDate };
  }
  const beforeDeadline =
    today < deadlineDate ||
    (today === deadlineDate && schoolMinutes(now) < DEADLINE_MINUTES);
  if (!beforeDeadline) return { ok: false, code: "ME101", deadlineDate };
  return { ok: true, deadlineDate };
}
