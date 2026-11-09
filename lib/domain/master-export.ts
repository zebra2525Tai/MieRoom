import { MESSAGES } from "../messages";
import {
  ANY_TEACHER,
  buildMasterData,
  CLOSURE_WARN_ROWS,
  MASTER_FILES,
  MASTER_HEADERS,
  MAX_ROWS,
  ROOM_TBD,
  type MasterFileKey,
  type MasterFileTexts,
} from "./master-csv";

// Writes the 8 CSV files for the Excel tool (外部設計書 08章 8-3, S24) from rows of the
// database, and runs the 書き出し前の確認 (R5-6) first: the tool turns red on a master CSV
// that breaks its rules, and then no 担任 can write a timetable CSV, so nothing is written
// while a check fails. Pure functions: no database, no files.

const KIND_TEXT = { HOMEROOM: "ホームルーム", FREE: "空き教室" } as const;

/** What the loader reads. Names are the keys, as in the files themselves. */
export type ExportSource = {
  /** Every room, active or not (a link to an inactive one is an error, R5-6 の5). */
  rooms: {
    name: string;
    building: string | null;
    kind: keyof typeof KIND_TEXT;
    note: string | null;
    active: boolean;
  }[];
  teachers: { displayName: string; active: boolean }[];
  subjects: { name: string; active: boolean }[];
  /** Classes that exist this school year and are active (R6-3), with their links. */
  classes: {
    name: string;
    homeRoom: string;
    subjects: string[];
    /** teacherName null = 各担当 */
    teachers: { subjectName: string; teacherName: string | null }[];
    /** roomName null = 教室未定 */
    rooms: { subjectName: string; roomName: string | null }[];
  }[];
  /**
   * Closures made in the system (S23) that touch the range of masterExportRange().
   * className null = the whole school. A class that is not exported is left out silently.
   */
  closures: {
    startDate: string;
    endDate: string | null;
    name: string;
    className: string | null;
  }[];
};

export type ExportIssue = {
  level: "error" | "warning";
  /** The number in the table of R5-6 (1〜7). null: found when the written files were read back. */
  check: number | null;
  message: string;
  /** Class, subject, file, ... */
  target: string;
  /** The screen where it is fixed. Empty when there is no single place. */
  fixPath: string;
};

export type ExportFile = {
  key: MasterFileKey;
  name: string;
  /** With a byte order mark, so that Excel opens it as UTF-8. */
  content: string;
  rows: number;
};

export type ExportResult = {
  /** Rows of each file (also when something is wrong, to show what would be written). */
  rowCounts: Record<MasterFileKey, number>;
  issues: ExportIssue[];
  /** null while any check is an error. */
  files: ExportFile[] | null;
};

/** 休み・行事: this school year (4/1 to 3/31) and the next 4/1 to 4/11 (08章 CSV-08). */
export function masterExportRange(year: number): {
  start: string;
  end: string;
} {
  return { start: `${year}-04-01`, end: `${year + 1}-04-11` };
}

const collator = new Intl.Collator("ja", { numeric: true });
const byText = (a: string, b: string) => collator.compare(a, b);

function quote(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** BOM, comma, CRLF, quotes only where needed (08章 8-1). */
function toCsv(key: MasterFileKey, rows: string[][]): string {
  return `﻿${[MASTER_HEADERS[key], ...rows]
    .map((row) => `${row.map(quote).join(",")}\r\n`)
    .join("")}`;
}

const FIX = {
  classes: "/admin/masters/classes",
  teachers: "/admin/masters/teachers",
  subjects: "/admin/masters/subjects",
  rooms: "/admin/masters/rooms",
  closures: "/admin/closures",
  linkSubjects: "/admin/links?tab=subjects",
  linkTeachers: "/admin/links?tab=teachers",
  linkRooms: "/admin/links?tab=rooms",
} as const;

/** Row limit of each table in the tool (R5-6 の6, の7) and where its rows are fixed. */
const FILE_RULES: Record<MasterFileKey, { limit: number; fixPath: string }> = {
  classes: { limit: MAX_ROWS.master, fixPath: FIX.classes },
  teachers: { limit: MAX_ROWS.master, fixPath: FIX.teachers },
  subjects: { limit: MAX_ROWS.master, fixPath: FIX.subjects },
  rooms: { limit: MAX_ROWS.master, fixPath: FIX.rooms },
  classSubjects: { limit: MAX_ROWS.link, fixPath: FIX.linkSubjects },
  subjectTeachers: { limit: MAX_ROWS.link, fixPath: FIX.linkTeachers },
  subjectRooms: { limit: MAX_ROWS.link, fixPath: FIX.linkRooms },
  closures: { limit: MAX_ROWS.closure, fixPath: FIX.closures },
};

export function buildExport(source: ExportSource): ExportResult {
  const issues: ExportIssue[] = [];
  const problem = (
    check: number | null,
    message: string,
    target: string,
    fixPath: string,
    level: ExportIssue["level"] = "error",
  ) => issues.push({ level, check, message, target, fixPath });

  const roomByName = new Map(source.rooms.map((room) => [room.name, room]));
  const teacherByName = new Map(source.teachers.map((t) => [t.displayName, t]));
  const subjectByName = new Map(source.subjects.map((s) => [s.name, s]));
  const classNames = new Set(source.classes.map((c) => c.name));

  // ---- R5-6 の1, の2: ホームルーム教室 ------------------------------------------------
  const classesByHomeRoom = new Map<string, string[]>();
  for (const item of source.classes) {
    const room = roomByName.get(item.homeRoom);
    if (room === undefined || !room.active) {
      problem(
        1,
        `ホームルーム教室「${item.homeRoom}」が${room === undefined ? "教室マスタにありません" : "無効です"}`,
        item.name,
        FIX.classes,
      );
    }
    classesByHomeRoom.set(item.homeRoom, [
      ...(classesByHomeRoom.get(item.homeRoom) ?? []),
      item.name,
    ]);
  }
  for (const [room, names] of classesByHomeRoom) {
    if (names.length > 1) {
      problem(
        2,
        `ホームルーム教室「${room}」が、同じ年度の複数のクラスで重なっています`,
        names.sort(byText).join("、"),
        FIX.classes,
      );
    }
  }

  // ---- 紐づけ: R5-6 の3, の4, の5 -----------------------------------------------------
  const linkRows = {
    classSubjects: [] as string[][],
    subjectTeachers: [] as string[][],
    subjectRooms: [] as string[][],
  };
  for (const item of source.classes) {
    const own = new Set(item.subjects);
    const hasTeacherRow = new Set(item.teachers.map((t) => t.subjectName));

    for (const subjectName of item.subjects) {
      if (subjectByName.get(subjectName)?.active !== true) {
        problem(
          5,
          `無効な教科「${subjectName}」が、クラスの教科に残っています`,
          item.name,
          FIX.linkSubjects,
        );
      }
      if (!hasTeacherRow.has(subjectName)) {
        problem(
          3,
          `「${subjectName}」に、講師の行がありません(「各担当」でもよい)`,
          item.name,
          FIX.linkTeachers,
        );
      }
      linkRows.classSubjects.push([item.name, subjectName]);
    }

    for (const row of item.teachers) {
      if (!own.has(row.subjectName)) {
        problem(
          4,
          `「${row.subjectName}」の講師の行があるのに、クラスの教科にありません`,
          item.name,
          FIX.linkTeachers,
        );
      }
      if (
        row.teacherName !== null &&
        teacherByName.get(row.teacherName)?.active !== true
      ) {
        problem(
          5,
          `無効な講師「${row.teacherName}」が、「${row.subjectName}」の講師に残っています`,
          item.name,
          FIX.linkTeachers,
        );
      }
      linkRows.subjectTeachers.push([
        item.name,
        row.subjectName,
        row.teacherName ?? ANY_TEACHER,
      ]);
    }

    for (const row of item.rooms) {
      if (!own.has(row.subjectName)) {
        problem(
          4,
          `「${row.subjectName}」の教室の行があるのに、クラスの教科にありません`,
          item.name,
          FIX.linkRooms,
        );
      }
      if (
        row.roomName !== null &&
        roomByName.get(row.roomName)?.active !== true
      ) {
        problem(
          5,
          `無効な教室「${row.roomName}」が、「${row.subjectName}」の教室に残っています`,
          item.name,
          FIX.linkRooms,
        );
      }
      linkRows.subjectRooms.push([
        item.name,
        row.subjectName,
        row.roomName ?? ROOM_TBD,
      ]);
    }
  }

  // ---- 休み・行事 --------------------------------------------------------------------
  const closureRows: string[][] = [];
  const seenClosures = new Set<string>();
  for (const closure of source.closures) {
    if (closure.className !== null && !classNames.has(closure.className)) {
      continue; // the class is not in this export: left out without a word (R5-6)
    }
    const row = [
      closure.startDate,
      closure.endDate === null || closure.endDate === closure.startDate
        ? ""
        : closure.endDate,
      closure.name,
      closure.className ?? "",
    ];
    const key = row.join("\u0000");
    if (seenClosures.has(key)) {
      problem(
        null,
        `同じ休み・行事が重複しています(${closure.startDate} ${closure.name})。ツールは、同じ行を受け付けません`,
        closure.className ?? "全校",
        FIX.closures,
      );
      continue;
    }
    seenClosures.add(key);
    closureRows.push(row);
  }

  // ---- 行数: R5-6 の6, の7, と空のファイル ------------------------------------------------
  const rows: Record<MasterFileKey, string[][]> = {
    classes: source.classes
      .map((c) => [c.name, c.homeRoom])
      .sort((a, b) => byText(a[0], b[0])),
    teachers: source.teachers
      .filter((t) => t.active)
      .map((t) => [t.displayName])
      .sort((a, b) => byText(a[0], b[0])),
    subjects: source.subjects
      .filter((s) => s.active)
      .map((s) => [s.name])
      .sort((a, b) => byText(a[0], b[0])),
    rooms: source.rooms
      .filter((r) => r.active)
      .map((r) => [r.name, r.building ?? "", KIND_TEXT[r.kind], r.note ?? ""])
      .sort((a, b) => byText(a[0], b[0])),
    classSubjects: linkRows.classSubjects,
    subjectTeachers: linkRows.subjectTeachers,
    subjectRooms: linkRows.subjectRooms,
    closures: closureRows.sort(
      (a, b) => byText(a[0], b[0]) || byText(a[2], b[2]) || byText(a[3], b[3]),
    ),
  };
  const byLink = (a: string[], b: string[]) =>
    byText(a[0], b[0]) || byText(a[1], b[1]) || byText(a[2] ?? "", b[2] ?? "");
  rows.classSubjects.sort(byLink);
  rows.subjectTeachers.sort(byLink);
  rows.subjectRooms.sort(byLink);

  const rowCounts = Object.fromEntries(
    (Object.keys(MASTER_FILES) as MasterFileKey[]).map((key) => [
      key,
      rows[key].length,
    ]),
  ) as Record<MasterFileKey, number>;

  for (const key of Object.keys(MASTER_FILES) as MasterFileKey[]) {
    const count = rowCounts[key];
    const name = MASTER_FILES[key];
    const { limit, fixPath } = FILE_RULES[key];
    if (count === 0) {
      problem(
        null,
        "データの行がありません。ツールは、空のファイルを受け付けません",
        name,
        fixPath,
      );
    }
    if (count > limit) {
      problem(
        key === "closures" ? 6 : 7,
        `${limit}行までです(${count}行)。ツールの表の上限です`,
        name,
        fixPath,
      );
    } else if (key === "closures" && count > CLOSURE_WARN_ROWS) {
      problem(6, MESSAGES.MW503(count), name, fixPath, "warning");
    }
  }

  if (issues.some((issue) => issue.level === "error")) {
    return { rowCounts, issues, files: null };
  }

  const files = (Object.keys(MASTER_FILES) as MasterFileKey[]).map((key) => ({
    key,
    name: MASTER_FILES[key],
    content: toCsv(key, rows[key]),
    rows: rowCounts[key],
  }));

  // Last: read the written text back with the same rules the system applies to these files
  // (the tool's rules, 08章 8-3). Whatever R5-6 did not foresee is stopped here.
  const texts = Object.fromEntries(
    files.map((file) => [file.key, file.content]),
  ) as MasterFileTexts;
  for (const issue of buildMasterData(texts).issues) {
    if (issue.level === "error") {
      problem(null, issue.message, "書き出すファイル", "");
    }
  }
  return {
    rowCounts,
    issues,
    files: issues.some((issue) => issue.level === "error") ? null : files,
  };
}
