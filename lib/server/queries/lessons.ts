import "server-only";
import type {
  LessonView,
  TimetableDay,
} from "@/components/screens/lesson-parts";
import type { HomeLessons } from "@/components/screens/home-view";
import { closureNamesOn } from "@/lib/domain/closures";
import { PERIODS, toMinutes, type PeriodNo } from "@/lib/domain/periods";
import { ALL_FREE, type RoomRow } from "@/lib/domain/room-status";
import {
  addDays,
  addMonths,
  dateColumnToText,
  textToDateColumn,
} from "@/lib/domain/school-date";
import {
  findCurrentAndNext,
  isEntered,
  lessonSlotsByRoom,
  NEXT_LESSON_DAYS,
  type MonthState,
  type MonthStates,
} from "@/lib/domain/timetable-read";
import { getDb } from "../db";
import { inYear, listClosuresForClass } from "./common";

// What S02, S03 and S04 read out of the imported timetable (E10, E11, E12).
// Callers have checked that somebody is signed in. Only what a screen shows is selected.

const monthKey = (month: string) => month.replace("-", "");
const collator = new Intl.Collator("ja");

const LESSON_COLUMNS = {
  id: true,
  date: true,
  startMinutes: true,
  endMinutes: true,
  subjectName: true,
  roomName: true,
  cancelled: true,
  origin: true,
  previousRoomName: true,
  previousTeacherNames: true,
  teachers: { select: { teacherName: true } },
  class: { select: { name: true } },
} as const;

type LessonRow = {
  id: string;
  date: Date;
  startMinutes: number;
  endMinutes: number;
  subjectName: string;
  roomName: string | null;
  cancelled: boolean;
  origin: "IMPORT" | "EXTRA";
  previousRoomName: string | null;
  previousTeacherNames: string | null;
  teachers: { teacherName: string }[];
  class: { name: string };
};

/** A lesson starts with its period (R3-1), so the period is found from the start. */
function periodNoOf(startMinutes: number): PeriodNo {
  return (
    PERIODS.find((period) => toMinutes(period.start) === startMinutes)?.no ?? 1
  );
}

function toView(row: LessonRow, withClassName: boolean): LessonView {
  return {
    id: row.id,
    date: dateColumnToText(row.date),
    periodNo: periodNoOf(row.startMinutes),
    subject: row.subjectName,
    teachers: row.teachers.map((t) => t.teacherName).sort(collator.compare),
    room: row.roomName,
    className: withClassName ? row.class.name : undefined,
    cancelled: row.cancelled,
    extra: row.origin === "EXTRA",
    previousRoom: row.previousRoomName,
    previousTeachers:
      row.previousTeacherNames === null
        ? null
        : row.previousTeacherNames.split("、").filter((n) => n !== ""),
  };
}

/** The months a date asks about: its own, and the one before (a provisional day, R3-6). */
function monthsAround(dates: string[]): string[] {
  const months = new Set<string>();
  for (const date of dates) {
    months.add(date.slice(0, 7));
    months.add(addMonths(date.slice(0, 7), -1));
  }
  return [...months];
}

/** 取り込みの状況 (E12) of the classes, by month. null: every class. */
async function loadMonthStates(
  classIds: string[] | null,
  months: string[],
): Promise<Map<string, MonthStates>> {
  const rows = await getDb().monthStatus.findMany({
    where: {
      ...(classIds === null ? {} : { classId: { in: classIds } }),
      month: { in: months.map(monthKey) },
    },
    select: {
      classId: true,
      month: true,
      importedAt: true,
      nextLastInputDate: true,
    },
  });
  const byClass = new Map<
    string,
    Map<string, MonthStates extends ReadonlyMap<string, infer V> ? V : never>
  >();
  for (const row of rows) {
    const states = byClass.get(row.classId) ?? new Map<string, MonthState>();
    states.set(`${row.month.slice(0, 4)}-${row.month.slice(4)}`, {
      imported: row.importedAt !== null,
      nextLastInputDate:
        row.nextLastInputDate === null
          ? null
          : dateColumnToText(row.nextLastInputDate),
    });
    byClass.set(row.classId, states);
  }
  return byClass;
}

const NO_STATES: MonthStates = new Map();

/**
 * The days of S03, for one class or for one teacher (all classes). A day is 入力済み when
 * the class has it (R3-7); for a teacher, when any class has it, so the lessons that are
 * known are shown.
 */
export async function loadTimetableDays(
  dates: string[],
  filter: { classId: string | null; teacherId: string | null },
): Promise<TimetableDay[]> {
  const db = getDb();
  const [from, to] = [dates[0], dates[dates.length - 1]];
  const between = {
    gte: textToDateColumn(from),
    lte: textToDateColumn(to),
  };
  const months = monthsAround(dates);
  const closures = await listClosuresForClass(
    from,
    to,
    filter.teacherId === null ? filter.classId : null,
  );

  let rows: LessonRow[] = [];
  let entered: (date: string) => boolean = () => false;
  if (filter.teacherId !== null) {
    const [found, states] = await Promise.all([
      db.lesson.findMany({
        where: {
          date: between,
          teachers: { some: { teacherId: filter.teacherId } },
        },
        select: LESSON_COLUMNS,
        orderBy: { startMinutes: "asc" },
      }),
      loadMonthStates(null, months),
    ]);
    rows = found;
    entered = (date) =>
      [...states.values()].some((classStates) => isEntered(date, classStates));
  } else if (filter.classId !== null) {
    const classId = filter.classId;
    const [found, states] = await Promise.all([
      db.lesson.findMany({
        where: { classId, date: between },
        select: LESSON_COLUMNS,
        orderBy: { startMinutes: "asc" },
      }),
      loadMonthStates([classId], months),
    ]);
    rows = found;
    entered = (date) => isEntered(date, states.get(classId) ?? NO_STATES);
  }

  const withClassName = filter.teacherId !== null;
  return dates.map((date) => ({
    date,
    entered: entered(date),
    closures: closureNamesOn(date, closures),
    lessons: rows
      .filter((row) => dateColumnToText(row.date) === date)
      .map((row) => toView(row, withClassName)),
  }));
}

/**
 * The rooms of S04 on a date. The slots taken by a lesson (R4-1). Reservations and
 * 使用止め are not here yet. `undecidedClasses` are the classes whose timetable of that
 * date is 未定 (MW001).
 */
export async function loadRoomRows(
  date: string,
  year: number,
): Promise<{ rooms: RoomRow[]; undecidedClasses: string[] }> {
  const db = getDb();
  const [rooms, lessons, classes] = await Promise.all([
    db.room.findMany({
      where: { active: true },
      select: { id: true, name: true, building: true, kind: true, note: true },
      orderBy: { name: "asc" },
    }),
    db.lesson.findMany({
      where: { date: textToDateColumn(date), roomId: { not: null } },
      select: {
        roomId: true,
        startMinutes: true,
        endMinutes: true,
        cancelled: true,
        class: { select: { name: true } },
      },
    }),
    db.schoolClass.findMany({
      where: inYear(year),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const states = await loadMonthStates(
    classes.map((c) => c.id),
    monthsAround([date]),
  );
  const byRoom = lessonSlotsByRoom(
    lessons.map(({ class: owner, ...lesson }) => ({
      ...lesson,
      className: owner.name,
    })),
  );
  return {
    rooms: rooms.map((room) => ({
      ...room,
      slots: byRoom.get(room.id) ?? ALL_FREE,
    })),
    undecidedClasses: classes
      .filter((item) => !isEntered(date, states.get(item.id) ?? NO_STATES))
      .map((item) => item.name),
  };
}

/** いまの授業と次の授業 of S02 (R6-2, R6-4). */
export async function loadHomeLessons(
  classId: string,
  today: string,
  minutes: number,
): Promise<HomeLessons> {
  const db = getDb();
  const last = addDays(today, NEXT_LESSON_DAYS);
  const [rows, states] = await Promise.all([
    db.lesson.findMany({
      where: {
        classId,
        date: {
          gte: textToDateColumn(today),
          lte: textToDateColumn(last),
        },
      },
      select: LESSON_COLUMNS,
    }),
    loadMonthStates([classId], monthsAround([today, last])),
  ]);
  const classStates = states.get(classId) ?? NO_STATES;
  const found = findCurrentAndNext({
    today,
    minutes,
    lessons: rows.map((row) => ({
      date: dateColumnToText(row.date),
      startMinutes: row.startMinutes,
      endMinutes: row.endMinutes,
      cancelled: row.cancelled,
      view: toView(row, false),
    })),
    isEntered: (date) => isEntered(date, classStates),
  });
  return found.kind === "undecided"
    ? { kind: "undecided" }
    : {
        kind: "ready",
        current: found.current?.view ?? null,
        next: found.next?.view ?? null,
      };
}
