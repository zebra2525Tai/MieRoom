// Puts the master data into the development database (npm run db:import-masters).
// The input is the 8 CSV files of 外部設計書 08章 8-3, in one folder. They are checked
// with the master rules first (lib/domain/master-csv.ts); one error and nothing is written.
//
//   npm run db:import-masters -- <folder>                 check only (nothing is written)
//   npm run db:import-masters -- <folder> --apply         write
//   --start-year 2026   the first school year of every class (default: this school year)
//   --replace           make the master data equal to the files (see below)
//
// Without --replace it is safe to run again: a row that already exists (same name, same
// pair) is kept as it is, so whatever was changed on the screens (S21〜S23) is not overwritten.
//
// --replace is for changing the demo data before real data exists. It deletes every class
// (and with it the class's links, and later its lessons), the school-wide closures made by
// the system, and the rooms, subjects and teachers that are not in the files. It refuses
// when a receiver is registered to a room that would go, or a removed teacher has a tag.
//
// Everything is written in one transaction: all of it, or none.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client";
import { fiscalYear } from "../lib/domain/fiscal-year";
import {
  buildMasterData,
  MASTER_FILES,
  type MasterData,
  type MasterFileKey,
  type MasterFileTexts,
} from "../lib/domain/master-csv";

function parseArgs(argv: string[]) {
  let folder: string | undefined;
  let apply = false;
  let replace = false;
  let startYear = fiscalYear(new Date());
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") apply = true;
    else if (arg === "--replace") replace = true;
    else if (arg === "--start-year") {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 2000 || value > 2100) {
        throw new Error("--start-year needs a year such as 2026");
      }
      startYear = value;
    } else if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
    else if (folder === undefined) folder = arg;
    else throw new Error("Give one folder only");
  }
  if (folder === undefined) {
    throw new Error(
      "Usage: npm run db:import-masters -- <folder> [--apply] [--replace] [--start-year 2026]",
    );
  }
  return { folder, apply, replace, startYear };
}

function must<T>(map: Map<string, T>, key: string, what: string): T {
  const value = map.get(key);
  if (value === undefined) throw new Error(`${what} not found: ${key}`);
  return value;
}

function day(value: string): Date {
  // A date without a time: midnight UTC is stored as that same calendar date.
  return new Date(`${value}T00:00:00Z`);
}

function summary(data: MasterData): string[] {
  return [
    `教室 ${data.rooms.length}、クラス ${data.classes.length}、講師 ${data.teachers.length}、教科 ${data.subjects.length}`,
    `クラスの教科 ${data.classSubjects.length}、教科の講師 ${data.subjectTeachers.length}、教科の教室 ${data.subjectRooms.length}、休み・行事 ${data.closures.length}`,
  ];
}

async function main() {
  if (process.env.APP_ENV === "production") {
    throw new Error("Refusing to import: APP_ENV is production");
  }
  const { folder, apply, replace, startYear } = parseArgs(
    process.argv.slice(2),
  );

  const files = {} as MasterFileTexts;
  for (const key of Object.keys(MASTER_FILES) as MasterFileKey[]) {
    files[key] = readFileSync(join(folder, MASTER_FILES[key]), "utf8");
  }
  const { data, issues } = buildMasterData(files);
  for (const issue of issues) {
    console.log(
      `${issue.level === "error" ? "エラー" : "警告"} [${issue.code}] ${issue.message}`,
    );
  }
  if (!data) {
    throw new Error("The files have errors, so nothing was written");
  }
  for (const line of summary(data)) console.log(line);
  console.log(`クラスの開始年度: ${startYear}`);
  if (!apply) {
    console.log(
      "確認だけ行いました(何も書いていません)。書き込むときは --apply を付けます。",
    );
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const db = new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
  });
  try {
    const created = await db.$transaction(
      async (tx) => {
        const count: Record<string, number> = {};

        if (replace) {
          const roomNames = data.rooms.map((r) => r.name);
          const teacherNames = data.teachers.map((t) => t.displayName);
          const subjectNames = data.subjects.map((s) => s.name);
          const strandedReceivers = await tx.receiver.count({
            where: { room: { name: { notIn: roomNames } } },
          });
          if (strandedReceivers > 0) {
            throw new Error(
              "Refusing to replace: receivers are registered to rooms that are not in the files",
            );
          }
          const taggedTeachers = await tx.teacher.count({
            where: {
              displayName: { notIn: teacherNames },
              tagId: { not: null },
            },
          });
          if (taggedTeachers > 0) {
            throw new Error(
              "Refusing to replace: a teacher that is not in the files has a tag",
            );
          }
          // Deleting the classes also deletes their links (the foreign keys cascade).
          await tx.closure.deleteMany({ where: { source: "SYSTEM" } });
          await tx.schoolClass.deleteMany();
          await tx.room.deleteMany({ where: { name: { notIn: roomNames } } });
          await tx.subject.deleteMany({
            where: { name: { notIn: subjectNames } },
          });
          await tx.teacher.deleteMany({
            where: { displayName: { notIn: teacherNames } },
          });
        }

        count["教室"] = (
          await tx.room.createMany({ data: data.rooms, skipDuplicates: true })
        ).count;
        const roomIds = new Map(
          (await tx.room.findMany({ select: { id: true, name: true } })).map(
            (r) => [r.name, r.id],
          ),
        );

        count["講師"] = (
          await tx.teacher.createMany({
            data: data.teachers,
            skipDuplicates: true,
          })
        ).count;
        const teacherIds = new Map(
          (
            await tx.teacher.findMany({
              select: { id: true, displayName: true },
            })
          ).map((t) => [t.displayName, t.id]),
        );

        count["教科"] = (
          await tx.subject.createMany({
            data: data.subjects,
            skipDuplicates: true,
          })
        ).count;
        const subjectIds = new Map(
          (await tx.subject.findMany({ select: { id: true, name: true } })).map(
            (s) => [s.name, s.id],
          ),
        );

        count["クラス"] = (
          await tx.schoolClass.createMany({
            data: data.classes.map((c) => ({
              name: c.name,
              homeRoomId: must(roomIds, c.homeRoom, "room"),
              startYear,
            })),
            skipDuplicates: true,
          })
        ).count;
        const classIds = new Map(
          (
            await tx.schoolClass.findMany({ select: { id: true, name: true } })
          ).map((c) => [c.name, c.id]),
        );

        count["クラスの教科"] = (
          await tx.classSubject.createMany({
            data: data.classSubjects.map((row) => ({
              classId: must(classIds, row.className, "class"),
              subjectId: must(subjectIds, row.subjectName, "subject"),
            })),
            skipDuplicates: true,
          })
        ).count;

        count["教科の講師"] = (
          await tx.subjectTeacher.createMany({
            data: data.subjectTeachers.map((row) => {
              const teacherId =
                row.teacherName === null
                  ? null
                  : must(teacherIds, row.teacherName, "teacher");
              return {
                classId: must(classIds, row.className, "class"),
                subjectId: must(subjectIds, row.subjectName, "subject"),
                teacherId,
                teacherKey: teacherId ?? "each",
              };
            }),
            skipDuplicates: true,
          })
        ).count;

        count["教科の教室"] = (
          await tx.subjectRoom.createMany({
            data: data.subjectRooms.map((row) => {
              const roomId =
                row.roomName === null
                  ? null
                  : must(roomIds, row.roomName, "room");
              return {
                classId: must(classIds, row.className, "class"),
                subjectId: must(subjectIds, row.subjectName, "subject"),
                roomId,
                roomKey: roomId ?? "none",
              };
            }),
            skipDuplicates: true,
          })
        ).count;

        // Closures have no natural key: skip the ones already there (same dates, name, class).
        const closureKey = (
          start: string,
          end: string | null,
          name: string,
          classId: string | null,
        ) => [start, end ?? "", name, classId ?? ""].join("\u0000");
        const dateText = (d: Date) => d.toISOString().slice(0, 10);
        const existing = new Set(
          (await tx.closure.findMany({ where: { source: "SYSTEM" } })).map(
            (c) =>
              closureKey(
                dateText(c.startDate),
                c.endDate ? dateText(c.endDate) : null,
                c.name,
                c.classId,
              ),
          ),
        );
        const newClosures = data.closures.flatMap((c) => {
          const classId =
            c.className === null ? null : must(classIds, c.className, "class");
          if (existing.has(closureKey(c.startDate, c.endDate, c.name, classId)))
            return [];
          return [
            {
              startDate: day(c.startDate),
              endDate: c.endDate === null ? null : day(c.endDate),
              name: c.name,
              classId,
              source: "SYSTEM" as const,
            },
          ];
        });
        count["休み・行事"] = (
          await tx.closure.createMany({ data: newClosures })
        ).count;

        return count;
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
    console.log(
      "書き込みました(新しく入った件数。すでにあるものは、そのままです):",
    );
    for (const [name, n] of Object.entries(created))
      console.log(`  ${name}: ${n}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  // Prisma's errors come from the generated client, so look at the message itself.
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String(error.message)
      : "Import failed";
  console.error(message);
  process.exit(1);
});
