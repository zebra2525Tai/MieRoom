import "server-only";
import type { ClosureItem } from "@/lib/domain/closures";
import { ALL_FREE, type RoomRow } from "@/lib/domain/room-status";
import { dateColumnToText, textToDateColumn } from "@/lib/domain/school-date";
import type { TeacherRow } from "@/components/screens/teachers-view";
import { getDb } from "../db";

// What the screens every signed-in person can open read from the database.
// Only the columns a screen shows are selected. Callers check the role first.

/** 年度 Y に存在していて、有効なクラス (R5-4, R6-3). */
export function inYear(year: number) {
  return {
    active: true,
    startYear: { lte: year },
    OR: [{ endYear: null }, { endYear: { gte: year } }],
  };
}

export function listClassesForYear(year: number) {
  return getDb().schoolClass.findMany({
    where: inYear(year),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function listActiveTeachers() {
  const rows = await getDb().teacher.findMany({
    where: { active: true },
    select: { id: true, displayName: true },
    orderBy: { displayName: "asc" },
  });
  return rows.map((row) => ({ id: row.id, name: row.displayName }));
}

/** Rows of a date column pair that touch a range. A row without an end is one day. */
export function overlapping(start: string, end: string) {
  return {
    startDate: { lte: textToDateColumn(end) },
    OR: [
      { endDate: { gte: textToDateColumn(start) } },
      { endDate: null, startDate: { gte: textToDateColumn(start) } },
    ],
  };
}

function toClosureItem(row: {
  startDate: Date;
  endDate: Date | null;
  name: string;
}): ClosureItem {
  return {
    startDate: dateColumnToText(row.startDate),
    endDate: row.endDate ? dateColumnToText(row.endDate) : null,
    name: row.name,
  };
}

const CLOSURE_COLUMNS = { startDate: true, endDate: true, name: true } as const;

/** Closures of the whole school in a range: these decide 営業日 (R4-3). */
export async function listSchoolClosures(start: string, end: string) {
  const rows = await getDb().closure.findMany({
    where: { ...overlapping(start, end), classId: null },
    select: CLOSURE_COLUMNS,
  });
  return rows.map(toClosureItem);
}

/** Closures a class sees: the whole school's and its own (R3-10). */
export async function listClosuresForClass(
  start: string,
  end: string,
  classId: string | null,
) {
  const rows = await getDb().closure.findMany({
    where: {
      ...overlapping(start, end),
      AND: [{ OR: [{ classId: null }, ...(classId ? [{ classId }] : [])] }],
    },
    select: CLOSURE_COLUMNS,
  });
  return rows.map(toClosureItem);
}

/**
 * The rooms for the lists and forms that do not show the slots of a day (S06, S11, S12,
 * S13): every slot is free. S04 reads the slots from the timetable (lessons.ts).
 */
export async function loadRoomList(): Promise<RoomRow[]> {
  const rows = await getDb().room.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      building: true,
      kind: true,
      note: true,
    },
    orderBy: { name: "asc" },
  });
  return rows.map((row) => ({ ...row, slots: ALL_FREE }));
}

/**
 * S05. 位置の表(E17)がまだないので、タグのある先生は「検知エリア外」(R7-2)。
 * タグIDそのものは画面に渡さない。
 */
export async function loadTeacherDirectory(
  year: number,
  query: string,
): Promise<TeacherRow[]> {
  const db = getDb();
  const [teachers, subjectRooms] = await Promise.all([
    db.teacher.findMany({
      where: {
        active: true,
        ...(query ? { displayName: { contains: query } } : {}),
      },
      select: {
        id: true,
        displayName: true,
        tagId: true,
        subjectTeachers: {
          where: { class: inYear(year) },
          select: {
            classId: true,
            subjectId: true,
            class: { select: { name: true } },
            subject: { select: { name: true } },
          },
        },
      },
      orderBy: { displayName: "asc" },
    }),
    db.subjectRoom.findMany({
      where: { class: inYear(year) },
      select: {
        classId: true,
        subjectId: true,
        room: { select: { name: true } },
      },
    }),
  ]);

  const roomsBySubject = new Map<string, string[]>();
  for (const row of subjectRooms) {
    const key = `${row.classId}/${row.subjectId}`;
    const rooms = roomsBySubject.get(key) ?? [];
    rooms.push(row.room?.name ?? "各教室");
    roomsBySubject.set(key, rooms);
  }

  return teachers.map((teacher) => ({
    id: teacher.id,
    name: teacher.displayName,
    location: teacher.tagId ? { kind: "out-of-area" } : { kind: "no-tag" },
    assignments: teacher.subjectTeachers
      .map((item) => ({
        className: item.class.name,
        subject: item.subject.name,
        rooms: roomsBySubject.get(`${item.classId}/${item.subjectId}`) ?? [],
      }))
      .sort(
        (a, b) =>
          a.className.localeCompare(b.className, "ja") ||
          a.subject.localeCompare(b.subject, "ja"),
      ),
  }));
}
