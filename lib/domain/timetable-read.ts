import { SLOTS, toMinutes, type SlotNo } from "./periods";
import { ALL_FREE, type SlotStatus } from "./room-status";
import { addDays, addMonths } from "./school-date";

// What the screens read out of the imported timetable. No I/O here.

/** One class's 取り込みの状況 (E12) of one month. */
export type MonthState = {
  /** The file of the month has been imported. */
  imported: boolean;
  /** 翌月の最終入力日 of that file: the provisional days of the next month (R3-6). */
  nextLastInputDate: string | null;
};

/** The state of each month ("YYYY-MM") of one class. */
export type MonthStates = ReadonlyMap<string, MonthState>;

/**
 * 入力済み (R3-7): the file of the date's month is imported, or the file of the month before
 * is imported and the date is not after its 翌月の最終入力日. Everything else is 未定.
 */
export function isEntered(date: string, states: MonthStates): boolean {
  const month = date.slice(0, 7);
  if (states.get(month)?.imported) return true;
  const before = states.get(addMonths(month, -1));
  return (
    before?.imported === true &&
    before.nextLastInputDate !== null &&
    date <= before.nextLastInputDate
  );
}

type Timed = {
  date: string;
  startMinutes: number;
  endMinutes: number;
  cancelled: boolean;
};

/** R6-4: how far ahead the next lesson is looked for. */
export const NEXT_LESSON_DAYS = 60;

/**
 * いまの授業 (R6-2) and 次の授業 (R6-4) of a class. `lessons` are its lessons from today on.
 * 休講 is left out. When today itself is 未定, nothing can be said. The search for the next
 * lesson skips days without lessons, stops at a 未定 day, and gives up after 60 days.
 */
export function findCurrentAndNext<T extends Timed>(input: {
  today: string;
  minutes: number;
  lessons: readonly T[];
  isEntered: (date: string) => boolean;
}):
  { kind: "undecided" } | { kind: "ready"; current: T | null; next: T | null } {
  const { today, minutes } = input;
  if (!input.isEntered(today)) return { kind: "undecided" };
  const byStart = (a: T, b: T) => a.startMinutes - b.startMinutes;
  const active = input.lessons.filter((lesson) => !lesson.cancelled);
  const onDay = (date: string) =>
    active.filter((lesson) => lesson.date === date).sort(byStart);

  const todays = onDay(today);
  const current =
    todays.find(
      (lesson) => lesson.startMinutes <= minutes && minutes < lesson.endMinutes,
    ) ?? null;
  let next = todays.find((lesson) => lesson.startMinutes > minutes) ?? null;
  for (let i = 1; next === null && i <= NEXT_LESSON_DAYS; i++) {
    const date = addDays(today, i);
    if (!input.isEntered(date)) break;
    next = onDay(date)[0] ?? null;
  }
  return { kind: "ready", current, next };
}

/**
 * 授業 of the 枠の状態 (R4-1): for each room, the slots taken by a lesson of a fixed room.
 * Overlap is by time (R3-1); a lesson ending when a slot starts does not take it.
 * 休講 and a lesson without a room are left out. Several classes in one room (合同) are joined.
 */
export function lessonSlotsByRoom(
  lessons: readonly {
    roomId: string | null;
    className: string;
    startMinutes: number;
    endMinutes: number;
    cancelled: boolean;
  }[],
): Map<string, Record<SlotNo, SlotStatus>> {
  const result = new Map<string, Record<SlotNo, SlotStatus>>();
  for (const lesson of lessons) {
    if (lesson.cancelled || lesson.roomId === null) continue;
    const slots = result.get(lesson.roomId) ?? { ...ALL_FREE };
    for (const slot of SLOTS) {
      if (
        lesson.startMinutes < toMinutes(slot.end) &&
        lesson.endMinutes > toMinutes(slot.start)
      ) {
        const current = slots[slot.no];
        const names =
          current.kind === "lesson" ? current.className.split("、") : [];
        slots[slot.no] = {
          kind: "lesson",
          className: names.includes(lesson.className)
            ? names.join("、")
            : [...names, lesson.className].join("、"),
        };
      }
    }
    result.set(lesson.roomId, slots);
  }
  return result;
}
