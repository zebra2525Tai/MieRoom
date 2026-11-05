import "server-only";
import type {
  ClosureRow,
  LinkTab,
  MasterData,
  MasterTab,
} from "@/components/screens/admin-views";
import type { ImportRow } from "@/components/screens/import-view";
import {
  dateColumnToText,
  fiscalYearOfDate,
  formatDate,
  formatMonth,
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
          homeRoom: { select: { name: true } },
        },
        orderBy: { name: "asc" },
      });
      return {
        tab,
        rows: rows.map(({ homeRoom, ...row }) => ({
          ...row,
          homeRoom: homeRoom.name,
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
        },
        orderBy: { displayName: "asc" },
      });
      return {
        tab,
        rows: rows.map(({ displayName, ...row }) => ({
          ...row,
          name: displayName,
        })),
      };
    }
    case "subjects": {
      const rows = await db.subject.findMany({
        where: active,
        select: { id: true, name: true, active: true },
        orderBy: { name: "asc" },
      });
      return { tab, rows };
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
          receivers: { select: { receiverId: true } },
        },
        orderBy: { name: "asc" },
      });
      return {
        tab,
        rows: rows.map(({ receivers, ...row }) => ({
          ...row,
          receivers: receivers.map((item) => item.receiverId),
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
        teacherKey: true,
        subject: { select: { name: true } },
        teacher: { select: { displayName: true } },
      },
    });
    return rows
      .map((row) => ({
        key: `${row.subject.name}/${row.teacherKey}`,
        subject: row.subject.name,
        value: row.teacher?.displayName ?? "各担当",
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject, "ja"));
  }
  if (tab === "rooms") {
    const rows = await db.subjectRoom.findMany({
      where: { classId },
      select: {
        roomKey: true,
        subject: { select: { name: true } },
        room: { select: { name: true } },
      },
    });
    return rows
      .map((row) => ({
        key: `${row.subject.name}/${row.roomKey}`,
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
      class: { select: { name: true } },
    },
    orderBy: [{ startDate: "asc" }, { name: "asc" }],
  });
  return {
    hasSchoolClosure: rows.some((row) => row.classId === null),
    rows: rows.map((row) => ({
      id: row.id,
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
  const years = months.map((month) => fiscalYearOfDate(`${month}-01`));
  const classes = await getDb().schoolClass.findMany({
    where: { active: true },
    select: { id: true, name: true, startYear: true, endYear: true },
    orderBy: { name: "asc" },
  });
  const existsIn = (
    item: { startYear: number; endYear: number | null },
    year: number,
  ) =>
    item.startYear <= year && (item.endYear === null || year <= item.endYear);
  return classes
    .filter((item) => years.some((year) => existsIn(item, year)))
    .map((item) => ({
      id: item.id,
      name: item.name,
      cells: [
        { imported: existsIn(item, years[0]) ? "none" : null },
        { imported: existsIn(item, years[1]) ? "none" : null },
      ],
    }));
}

export async function loadAccess() {
  const db = getDb();
  const [teachers, receivers] = await Promise.all([
    db.teacher.findMany({
      where: { active: true },
      select: { id: true, displayName: true, tagId: true },
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
    })),
    receivers: receivers.map((row) => ({
      id: row.id,
      receiverId: row.receiverId,
      room: row.room.name,
    })),
  };
}
