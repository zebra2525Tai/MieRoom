import "server-only";
import { fiscalYearOfDate, schoolToday } from "@/lib/domain/school-date";
import { MESSAGES } from "@/lib/messages";
import { getDb } from "./db";
import { countExportIssues } from "./master-edit";
import { inYear } from "./queries/common";
import { UUID } from "./reservations";

// S22 紐づけ (F16): クラスの教科, 教科の講師, 教科の教室. The route has checked the site, the
// sign-in and the 時間割管理者 role. How the rows tie together (does a subject have a teacher
// row, ...) is not checked here: it is the check before the export (R5-5, R5-6).

export type LinkTab = "subjects" | "teachers" | "rooms";

/** 各担当 and 教室未定 are rows of their own: these are their keys (the same as the importer's). */
export const EACH_TEACHER = "each";
export const NO_ROOM = "none";

export type LinkResult =
  | { kind: "saved"; exportIssues: number }
  | { kind: "invalid"; message: string }
  | { kind: "not_found" };

const isTab = (value: unknown): value is LinkTab =>
  value === "subjects" || value === "teachers" || value === "rooms";

const isDuplicate = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code: unknown }).code === "P2002";

const uuid = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value);

/** A class of this school year that is active (S22 条件). */
async function findClass(classId: unknown, now: Date) {
  if (!uuid(classId)) return null;
  return getDb().schoolClass.findFirst({
    where: { id: classId, ...inYear(fiscalYearOfDate(schoolToday(now))) },
    select: { id: true },
  });
}

const saved = async (now: Date): Promise<LinkResult> => ({
  kind: "saved",
  exportIssues: await countExportIssues(now),
});

/** 追加. The choices are only what S22 offers: active subjects, teachers, rooms. */
export async function addLink(
  tab: unknown,
  body: Record<string, unknown>,
  now: Date,
): Promise<LinkResult> {
  if (!isTab(tab)) return { kind: "not_found" };
  const klass = await findClass(body.classId, now);
  if (klass === null || !uuid(body.subjectId)) return { kind: "not_found" };
  const db = getDb();
  const classId = klass.id;
  const subjectId = body.subjectId;
  const invalid = { kind: "invalid", message: MESSAGES.ME706 } as const;

  const subject = await db.subject.findFirst({
    where: { id: subjectId, active: true },
    select: { id: true },
  });
  if (subject === null) return invalid;

  try {
    if (tab === "subjects") {
      await db.classSubject.create({ data: { classId, subjectId } });
      return await saved(now);
    }
    // The subject of a teacher or a room is one of the class's subjects.
    const ofClass = await db.classSubject.findUnique({
      where: { classId_subjectId: { classId, subjectId } },
      select: { classId: true },
    });
    if (ofClass === null) return invalid;

    if (tab === "teachers") {
      const target = body.teacherId;
      if (target === EACH_TEACHER) {
        await db.subjectTeacher.create({
          data: {
            classId,
            subjectId,
            teacherId: null,
            teacherKey: EACH_TEACHER,
          },
        });
      } else {
        if (!uuid(target)) return invalid;
        const teacher = await db.teacher.findFirst({
          where: { id: target, active: true },
          select: { id: true },
        });
        if (teacher === null) return invalid;
        await db.subjectTeacher.create({
          data: { classId, subjectId, teacherId: target, teacherKey: target },
        });
      }
      return await saved(now);
    }

    const target = body.roomId;
    if (target === NO_ROOM) {
      await db.subjectRoom.create({
        data: { classId, subjectId, roomId: null, roomKey: NO_ROOM },
      });
    } else {
      if (!uuid(target)) return invalid;
      const room = await db.room.findFirst({
        where: { id: target, active: true },
        select: { id: true },
      });
      if (room === null) return invalid;
      await db.subjectRoom.create({
        data: { classId, subjectId, roomId: target, roomKey: target },
      });
    }
    return await saved(now);
  } catch (error) {
    if (isDuplicate(error)) return { kind: "invalid", message: MESSAGES.ME506 };
    throw error;
  }
}

/** 削除 of one row (the screen asked first: MC504). */
export async function removeLink(
  tab: unknown,
  body: Record<string, unknown>,
  now: Date,
): Promise<LinkResult> {
  if (!isTab(tab) || !uuid(body.classId) || !uuid(body.subjectId)) {
    return { kind: "not_found" };
  }
  const db = getDb();
  const { classId, subjectId } = body;
  let count = 0;
  if (tab === "subjects") {
    count = (
      await db.classSubject.deleteMany({ where: { classId, subjectId } })
    ).count;
  } else if (tab === "teachers") {
    const key = body.targetKey;
    if (key !== EACH_TEACHER && !uuid(key)) return { kind: "not_found" };
    count = (
      await db.subjectTeacher.deleteMany({
        where: { classId, subjectId, teacherKey: key as string },
      })
    ).count;
  } else {
    const key = body.targetKey;
    if (key !== NO_ROOM && !uuid(key)) return { kind: "not_found" };
    count = (
      await db.subjectRoom.deleteMany({
        where: { classId, subjectId, roomKey: key as string },
      })
    ).count;
  }
  return count === 1 ? await saved(now) : { kind: "not_found" };
}
