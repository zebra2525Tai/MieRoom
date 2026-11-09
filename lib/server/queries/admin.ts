import "server-only";
import type {
  ClosureRow,
  LinkTab,
  MasterData,
  MasterTab,
} from "@/components/screens/admin-views";
import type { ImportCell, ImportRow } from "@/components/screens/import-view";
import {
  addMonths,
  dateColumnToText,
  fiscalYearOfDate,
  formatDate,
  formatMonth,
  schoolDateTimeText,
  textToDateColumn,
} from "@/lib/domain/school-date";
import { getDb } from "../db";
import { overlapping } from "./common";

// What the 時間割管理者 screens read. Callers check the admin role first.

export async function loadMaster(
  tab: MasterTab,
  showInactive: boolean,
): Promise<MasterData> {
  const db = getDb();
  const active = showInactive ? {} : { active: true };
  switch (tab) {
    case "classes": {
      const rows = await db.schoolClass.findMany({
        where: active,
        select: {
          id: true,
          name: true,
          startYear: true,
          endYear: true,
          active: true,
          updatedAt: true,
          homeRoomId: true,
          homeRoom: { select: { name: true } },
        },
        orderBy: { name: "asc" },
      });
      return {
        tab,
        rows: rows.map(({ homeRoom, updatedAt, ...row }) => ({
          ...row,
          homeRoom: homeRoom.name,
          version: updatedAt.toISOString(),
        })),
      };
    }
    case "teachers": {
      const rows = await db.teacher.findMany({
        where: active,
        select: {
          id: true,
          displayName: true,
          email: true,
          tagId: true,
          active: true,
          updatedAt: true,
        },
        orderBy: { displayName: "asc" },
      });
      return {
        tab,
        rows: rows.map(({ displayName, updatedAt, ...row }) => ({
          ...row,
          name: displayName,
          version: updatedAt.toISOString(),
        })),
      };
    }
    case "subjects": {
      const rows = await db.subject.findMany({
        where: active,
        select: { id: true, name: true, active: true, updatedAt: true },
        orderBy: { name: "asc" },
      });
      return {
        tab,
        rows: rows.map(({ updatedAt, ...row }) => ({
          ...row,
          version: updatedAt.toISOString(),
        })),
      };
    }
    case "rooms": {
      const rows = await db.room.findMany({
        where: active,
        select: {
          id: true,
          name: true,
          building: true,
          kind: true,
          note: true,
          active: true,
          updatedAt: true,
          receivers: { select: { receiverId: true } },
        },
        orderBy: { name: "asc" },
      });
      return {
        tab,
        rows: rows.map(({ receivers, updatedAt, ...row }) => ({
          ...row,
          receivers: receivers.map((item) => item.receiverId),
          version: updatedAt.toISOString(),
        })),
      };
    }
  }
}

export async function loadLinks(tab: LinkTab, classId: string) {
  const db = getDb();
  if (tab === "teachers") {
    const rows = await db.subjectTeacher.findMany({
      where: { classId },
      select: {
        subjectId: true,
        teacherKey: true,
        subject: { select: { name: true } },
        teacher: { select: { displayName: true } },
      },
    });
    return rows
      .map((row) => ({
        key: `${row.subject.name}/${row.teacherKey}`,
        subjectId: row.subjectId,
        targetKey: row.teacherKey,
        subject: row.subject.name,
        value: row.teacher?.displayName ?? "各担当",
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject, "ja"));
  }
  if (tab === "rooms") {
    const rows = await db.subjectRoom.findMany({
      where: { classId },
      select: {
        subjectId: true,
        roomKey: true,
        subject: { select: { name: true } },
        room: { select: { name: true } },
      },
    });
    return rows
      .map((row) => ({
        key: `${row.subject.name}/${row.roomKey}`,
        subjectId: row.subjectId,
        targetKey: row.roomKey,
        subject: row.subject.name,
        value: row.room?.name ?? "ー(教室未定)",
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject, "ja"));
  }
  const [subjects, withTeacher] = await Promise.all([
    db.classSubject.findMany({
      where: { classId },
      select: { subjectId: true, subject: { select: { name: true } } },
    }),
    db.subjectTeacher.findMany({
      where: { classId },
      select: { subjectId: true },
    }),
  ]);
  const hasTeacher = new Set(withTeacher.map((row) => row.subjectId));
  return subjects
    .map((row) => ({
      key: row.subjectId,
      subjectId: row.subjectId,
      targetKey: "",
      subject: row.subject.name,
      value: "",
      missing: !hasTeacher.has(row.subjectId),
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject, "ja"));
}

export async function loadClosuresOfYear(
  year: number,
  today: string,
): Promise<{ rows: ClosureRow[]; hasSchoolClosure: boolean }> {
  const start = `${year}-04-01`;
  const end = `${year + 1}-03-31`;
  const rows = await getDb().closure.findMany({
    where: overlapping(start, end),
    select: {
      id: true,
      startDate: true,
      endDate: true,
      name: true,
      classId: true,
      source: true,
      targetMonth: true,
      updatedAt: true,
      class: { select: { name: true } },
    },
    orderBy: [{ startDate: "asc" }, { name: "asc" }],
  });
  return {
    hasSchoolClosure: rows.some((row) => row.classId === null),
    rows: rows.map((row) => ({
      id: row.id,
      // Only the rows made in the system can be changed (the others come from the tool).
      editable: row.source === "SYSTEM",
      startDate: dateColumnToText(row.startDate),
      endDate: row.endDate ? dateColumnToText(row.endDate) : null,
      classId: row.classId,
      version: row.updatedAt.toISOString(),
      startText: formatDate(dateColumnToText(row.startDate), today),
      endText: row.endDate
        ? formatDate(dateColumnToText(row.endDate), today)
        : "—",
      name: row.name,
      target: row.class?.name ?? "全校",
      source:
        row.source === "SYSTEM"
          ? "システム"
          : `ツール(${row.class?.name ?? ""}・${
              row.targetMonth
                ? formatMonth(
                    `${row.targetMonth.slice(0, 4)}-${row.targetMonth.slice(4, 6)}`,
                  )
                : ""
            })`,
    })),
  };
}

/** Rows of the S20 status table. 取り込みの状況(E12)がまだないので、どれも未取込。 */
export async function loadImportRows(
  months: [string, string],
): Promise<ImportRow[]> {
  const db = getDb();
  const years = months.map((month) => fiscalYearOfDate(`${month}-01`));
  const key = (month: string) => month.replace("-", "");
  const [classes, statuses, changed] = await Promise.all([
    db.schoolClass.findMany({
      where: { active: true },
      select: { id: true, name: true, startYear: true, endYear: true },
      orderBy: { name: "asc" },
    }),
    // The month before is read too: its 翌月の最終入力日 makes the first column 仮の時間割 (R3-7).
    db.monthStatus.findMany({
      where: { month: { in: [addMonths(months[0], -1), ...months].map(key) } },
      select: {
        classId: true,
        month: true,
        importedAt: true,
        nextLastInputDate: true,
        exceptionUnlocked: true,
      },
    }),
    // Lessons changed in the system (R3-11) in the two months (MW703, R3-12).
    db.lesson.findMany({
      where: {
        date: {
          gte: textToDateColumn(`${months[0]}-01`),
          lt: textToDateColumn(`${addMonths(months[1], 1)}-01`),
        },
        OR: [
          { origin: "EXTRA" },
          { cancelled: true },
          { changedAt: { not: null } },
        ],
      },
      select: { classId: true, date: true },
    }),
  ]);
  const existsIn = (
    item: { startYear: number; endYear: number | null },
    year: number,
  ) =>
    item.startYear <= year && (item.endYear === null || year <= item.endYear);
  const statusOf = new Map(
    statuses.map((row) => [`${row.classId}|${row.month}`, row]),
  );
  const changedOf = new Map<string, number>();
  for (const lesson of changed) {
    const month = dateColumnToText(lesson.date).slice(0, 7);
    const id = `${lesson.classId}|${key(month)}`;
    changedOf.set(id, (changedOf.get(id) ?? 0) + 1);
  }

  return classes
    .filter((item) => years.some((year) => existsIn(item, year)))
    .map((item) => ({
      id: item.id,
      name: item.name,
      cells: months.map((month, index): ImportCell => {
        if (!existsIn(item, years[index])) return { imported: null };
        const own = statusOf.get(`${item.id}|${key(month)}`);
        const before = statusOf.get(`${item.id}|${key(addMonths(month, -1))}`);
        const changedLessons = changedOf.get(`${item.id}|${key(month)}`);
        return {
          imported:
            own?.importedAt != null
              ? "done"
              : before?.importedAt != null && before.nextLastInputDate !== null
                ? "provisional"
                : "none",
          importedText:
            own?.importedAt != null
              ? `${schoolDateTimeText(own.importedAt)} に取り込み`
              : undefined,
          changedLessons,
          unlocked: own?.exceptionUnlocked === true,
        };
      }) as [ImportCell, ImportCell],
    }));
}

export async function loadAccess() {
  const db = getDb();
  const [teachers, receivers] = await Promise.all([
    // Every active teacher, and an inactive one that still holds a tag (it blocks the number).
    db.teacher.findMany({
      where: { OR: [{ active: true }, { tagId: { not: null } }] },
      select: { id: true, displayName: true, tagId: true, active: true },
      orderBy: { displayName: "asc" },
    }),
    db.receiver.findMany({
      select: {
        id: true,
        receiverId: true,
        room: { select: { name: true } },
      },
      orderBy: { receiverId: "asc" },
    }),
  ]);
  return {
    teachers: teachers.map((row) => ({
      id: row.id,
      name: row.displayName,
      tagId: row.tagId,
      active: row.active,
    })),
    receivers: receivers.map((row) => ({
      id: row.id,
      receiverId: row.receiverId,
      room: row.room.name,
    })),
  };
}

/** What the 追加 box of S22 offers: the choices of each list (active ones only). */
export async function loadLinkChoices(classId: string) {
  const db = getDb();
  const [subjects, ofClass, teachers, rooms] = await Promise.all([
    db.subject.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.classSubject.findMany({
      where: { classId },
      select: { subjectId: true },
    }),
    db.teacher.findMany({
      where: { active: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
    db.room.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const linked = new Set(ofClass.map((row) => row.subjectId));
  return {
    // クラスの教科: not yet in the class
    newSubjects: subjects.filter((item) => !linked.has(item.id)),
    // 教科の講師・教科の教室: one of the class's subjects
    classSubjects: subjects.filter((item) => linked.has(item.id)),
    teachers: teachers.map((item) => ({ id: item.id, name: item.displayName })),
    rooms,
  };
}
