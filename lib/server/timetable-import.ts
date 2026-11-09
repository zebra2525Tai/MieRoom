import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { ClosureItem } from "@/lib/domain/closures";
import { monthWindow } from "@/lib/domain/import-window";
import { MESSAGES } from "@/lib/messages";
import {
  addMonths,
  dateColumnToText,
  fiscalYearOfDate,
  schoolToday,
  textToDateColumn,
} from "@/lib/domain/school-date";
import {
  checkTimetableImport,
  planWrite,
  replaceRanges,
  type ApplyResult,
  type ImportCheckView,
  type ImportItem,
  type ImportSummary,
} from "@/lib/domain/timetable-import";
import type { ImportMasters } from "@/lib/domain/timetable-csv";
import { getDb } from "./db";
import { inYear, overlapping } from "./queries/common";

// 時間割の取り込み (外部設計書 F13, F14, R3-2〜R3-12). Callers check the admin role first.

export type UploadedFile = { name: string; bytes: Uint8Array };

export type { ApplyResult, ImportCheckView, ImportSummary };

const monthKey = (month: string) => month.replace("-", ""); // "2026-11" -> "202611"

async function loadMasters(): Promise<ImportMasters> {
  const db = getDb();
  const [classes, subjects, teachers, rooms] = await Promise.all([
    db.schoolClass.findMany({
      select: {
        name: true,
        startYear: true,
        endYear: true,
        active: true,
        homeRoom: { select: { name: true } },
      },
    }),
    db.subject.findMany({ select: { name: true, active: true } }),
    db.teacher.findMany({ select: { displayName: true, active: true } }),
    db.room.findMany({ select: { name: true, active: true } }),
  ]);
  return {
    classes: classes.map(({ homeRoom, ...item }) => ({
      ...item,
      homeRoom: homeRoom.name,
    })),
    subjects,
    teachers: teachers.map((t) => ({ name: t.displayName, active: t.active })),
    rooms,
  };
}

/** 例外解除 (R3-5): "クラス名|YYYY-MM" */
async function loadUnlocked(): Promise<Set<string>> {
  const rows = await getDb().monthStatus.findMany({
    where: { exceptionUnlocked: true },
    select: { month: true, class: { select: { name: true } } },
  });
  return new Set(
    rows.map(
      (row) =>
        `${row.class.name}|${row.month.slice(0, 4)}-${row.month.slice(4)}`,
    ),
  );
}

/**
 * MW703 (R3-12): lessons changed in the system (a different room or teacher, 休講, 補講)
 * inside what each file would replace. One query for all files.
 */
async function countSystemChanges(
  targets: { className: string; month: string }[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (targets.length === 0) return result;
  const db = getDb();
  const classNames = [...new Set(targets.map((t) => t.className))];
  const months = [...new Set(targets.map((t) => addMonths(t.month, 1)))];
  const imported = await db.monthStatus.findMany({
    where: {
      class: { name: { in: classNames } },
      month: { in: months.map(monthKey) },
      importedAt: { not: null },
    },
    select: { month: true, class: { select: { name: true } } },
  });
  const nextImported = new Set(
    imported.map((r) => `${r.class.name}|${r.month}`),
  );
  const ranges = new Map(
    targets.map((t) => [
      `${t.className}|${t.month}`,
      replaceRanges(
        t.month,
        nextImported.has(`${t.className}|${monthKey(addMonths(t.month, 1))}`),
      ),
    ]),
  );
  const all = [...ranges.values()].flat();
  const from = all.map((r) => r.from).sort()[0];
  const to = all
    .map((r) => r.to)
    .sort()
    .at(-1)!;
  const changed = await db.lesson.findMany({
    where: {
      class: { name: { in: classNames } },
      date: { gte: textToDateColumn(from), lte: textToDateColumn(to) },
      OR: [
        { origin: "EXTRA" },
        { cancelled: true },
        { changedAt: { not: null } },
      ],
    },
    select: { date: true, class: { select: { name: true } } },
  });
  for (const target of targets) {
    const key = `${target.className}|${target.month}`;
    const count = changed.filter((lesson) => {
      const date = dateColumnToText(lesson.date);
      return (
        lesson.class.name === target.className &&
        ranges.get(key)!.some((r) => date >= r.from && date <= r.to)
      );
    }).length;
    if (count > 0) result.set(key, count);
  }
  return result;
}

/** 「確認する」: reads nothing into the database. */
export async function runCheck(
  files: UploadedFile[],
  now: Date,
): Promise<{ view: ImportCheckView; items: ImportItem[] }> {
  const [masters, unlocked] = await Promise.all([
    loadMasters(),
    loadUnlocked(),
  ]);
  const check = checkTimetableImport(files, {
    today: schoolToday(now),
    masters,
    unlocked,
  });

  const targets = check.files.flatMap((file) =>
    file.className !== null && file.month !== null && file.verdict !== "error"
      ? [{ file, className: file.className, month: file.month }]
      : [],
  );
  const counts = await countSystemChanges(targets);
  let lostChanges = 0;
  for (const { file, className, month } of targets) {
    const count = counts.get(`${className}|${month}`) ?? 0;
    if (count === 0) continue;
    lostChanges += count;
    file.issues.push({
      level: "warning",
      code: "MW703",
      line: null,
      message: MESSAGES.MW703(count),
    });
    file.verdict = "warning";
  }
  return {
    view: {
      files: check.files,
      general: check.general,
      ok: check.ok,
      lostChanges,
    },
    items: check.items,
  };
}

const CHUNK = 2000;
async function inChunks<T>(rows: T[], write: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await write(rows.slice(i, i + CHUNK));
  }
}

/**
 * Writes everything in one transaction: all of it, or none (R3-2).
 * Every round trip to the database costs about 0.1 s, so the work is done for all files at
 * once (one delete, a few bulk inserts), never one file after the other.
 */
export async function writeItems(
  tx: Prisma.TransactionClient,
  items: ImportItem[],
  now: Date,
): Promise<ImportSummary> {
  const [classes, subjects, teachers, rooms] = await Promise.all([
    tx.schoolClass.findMany({ select: { id: true, name: true } }),
    tx.subject.findMany({ select: { id: true, name: true } }),
    tx.teacher.findMany({ select: { id: true, displayName: true } }),
    tx.room.findMany({ select: { id: true, name: true } }),
  ]);
  const classId = new Map(classes.map((c) => [c.name, c.id]));
  const subjectId = new Map(subjects.map((s) => [s.name, s.id]));
  const teacherId = new Map(teachers.map((t) => [t.displayName, t.id]));
  const roomId = new Map(rooms.map((r) => [r.name, r.id]));
  const need = <T>(map: Map<string, T>, key: string): T => {
    const value = map.get(key);
    if (value === undefined)
      throw new Error(`Changed during the import: ${key}`);
    return value;
  };

  const ordered = [...items].sort(
    (a, b) =>
      a.month.localeCompare(b.month) || a.className.localeCompare(b.className),
  );
  const ids = ordered.map((item) => need(classId, item.className));
  const nextMonths = [
    ...new Set(ordered.map((i) => monthKey(addMonths(i.month, 1)))),
  ];
  const dates = ordered
    .flatMap((i) => [`${i.month}-01`, `${addMonths(i.month, 1)}-11`])
    .sort();

  const [importedRows, schoolRows] = await Promise.all([
    tx.monthStatus.findMany({
      where: {
        classId: { in: ids },
        month: { in: nextMonths },
        importedAt: { not: null },
      },
      select: { classId: true, month: true },
    }),
    tx.closure.findMany({
      where: { ...overlapping(dates[0], dates.at(-1)!), classId: null },
      select: { startDate: true, endDate: true, name: true },
    }),
  ]);
  const imported = new Set(importedRows.map((r) => `${r.classId}|${r.month}`));
  const inThisImport = new Set(
    ordered.map((item, i) => `${ids[i]}|${monthKey(item.month)}`),
  );
  const schoolClosures: ClosureItem[] = schoolRows.map((row) => ({
    startDate: dateColumnToText(row.startDate),
    endDate: row.endDate ? dateColumnToText(row.endDate) : null,
    name: row.name,
  }));

  const between = (range: { from: string; to: string }) => ({
    gte: textToDateColumn(range.from),
    lte: textToDateColumn(range.to),
  });
  const lessonRows: {
    id: string;
    classId: string;
    lesson: ImportItem["lessons"][number];
  }[] = [];
  const closureRows: { classId: string; date: string; name: string }[] = [];
  const replaced: { classId: string; date: ReturnType<typeof between> }[] = [];
  const summary = new Map<string, { classes: number; lessons: number }>();

  ordered.forEach((item, i) => {
    const id = ids[i];
    const next = monthKey(addMonths(item.month, 1));
    // The next month's own file, in the database or in this very import, replaces the
    // provisional days anyway (R3-6): they are not written first.
    const plan = planWrite(item, {
      nextMonthImported:
        imported.has(`${id}|${next}`) || inThisImport.has(`${id}|${next}`),
      schoolClosures,
    });
    for (const range of plan.replace)
      replaced.push({ classId: id, date: between(range) });
    for (const lesson of plan.lessons)
      lessonRows.push({ id: randomUUID(), classId: id, lesson });
    for (const closure of plan.closures)
      closureRows.push({ classId: id, ...closure });
    const line = summary.get(item.month) ?? { classes: 0, lessons: 0 };
    summary.set(item.month, {
      classes: line.classes + 1,
      lessons:
        line.lessons +
        plan.lessons.filter((l) => l.date.startsWith(item.month)).length,
    });
  });

  // Lessons of the ranges are replaced whatever their source; their teachers go with them (R3-2, R3-12).
  await tx.lesson.deleteMany({ where: { OR: replaced } });
  await tx.closure.deleteMany({
    where: {
      source: "TOOL",
      OR: replaced.map((r) => ({ classId: r.classId, startDate: r.date })),
    },
  });
  await tx.monthStatus.deleteMany({
    where: {
      OR: ordered.map((item, i) => ({
        classId: ids[i],
        month: monthKey(item.month),
      })),
    },
  });

  await inChunks(lessonRows, (chunk) =>
    tx.lesson.createMany({
      data: chunk.map(({ id, classId: owner, lesson }) => ({
        id,
        classId: owner,
        date: textToDateColumn(lesson.date),
        startMinutes: lesson.startMinutes,
        endMinutes: lesson.endMinutes,
        subjectId: need(subjectId, lesson.subject),
        subjectName: lesson.subject,
        roomId: lesson.room === null ? null : need(roomId, lesson.room),
        roomName: lesson.room,
        kind: lesson.room === null ? "ROOM_TBD" : "FIXED",
      })),
    }),
  );
  await inChunks(
    lessonRows.flatMap(({ id, lesson }) =>
      lesson.teachers.map((name) => ({
        lessonId: id,
        teacherName: name,
        teacherId: need(teacherId, name),
      })),
    ),
    (chunk) => tx.lessonTeacher.createMany({ data: chunk }),
  );
  await inChunks(closureRows, (chunk) =>
    tx.closure.createMany({
      data: chunk.map((closure) => ({
        startDate: textToDateColumn(closure.date),
        name: closure.name,
        classId: closure.classId,
        source: "TOOL" as const,
        targetMonth: monthKey(closure.date.slice(0, 7)),
      })),
    }),
  );
  // The status rows were deleted above, so this also closes the exception again (R3-5).
  await tx.monthStatus.createMany({
    data: ordered.map((item, i) => ({
      classId: ids[i],
      month: monthKey(item.month),
      lastInputDate: textToDateColumn(item.lastInputDate),
      nextLastInputDate:
        item.nextLastInputDate === null
          ? null
          : textToDateColumn(item.nextLastInputDate),
      importedAt: now,
      exceptionUnlocked: false,
    })),
  });

  return {
    months: [...summary.entries()].map(([month, line]) => ({ month, ...line })),
  };
}

/**
 * 「取り込む」: checks again (what the screen showed is not trusted), then writes.
 * Nothing is written when anything is an error.
 */
export async function runApply(
  files: UploadedFile[],
  now: Date,
): Promise<ApplyResult> {
  const { view, items } = await runCheck(files, now);
  if (!view.ok) return { kind: "invalid", view };
  const summary = await getDb().$transaction(
    (tx) => writeItems(tx, items, now),
    { maxWait: 5_000, timeout: 60_000 },
  );
  return { kind: "imported", view, summary };
}

export type UnlockResult = "unlocked" | "not-allowed" | "no-class";

/**
 * 例外解除 (R3-5): only for this month, from the 26th to the end of the month, and only
 * for a class of that school year. It closes again after one import.
 */
export async function unlockException(
  classId: string,
  month: string,
  now: Date,
): Promise<UnlockResult> {
  const today = schoolToday(now);
  if (monthWindow(today, month) !== "closed") return "not-allowed";
  const db = getDb();
  const found = await db.schoolClass.findFirst({
    where: { id: classId, ...inYear(fiscalYearOfDate(`${month}-01`)) },
    select: { id: true },
  });
  if (found === null) return "no-class";
  await db.monthStatus.upsert({
    where: { classId_month: { classId, month: monthKey(month) } },
    create: { classId, month: monthKey(month), exceptionUnlocked: true },
    update: { exceptionUnlocked: true },
  });
  return "unlocked";
}
