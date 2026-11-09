import Papa from "papaparse";
import { MESSAGES } from "../messages";
import { normalizeRoomName, ROOM_TBD } from "./master-csv";
import { PERIODS, toMinutes, type PeriodNo } from "./periods";
import { addDays, addMonths, isSchoolDate, weekdayOf } from "./school-date";

// Reads one 取込用CSV (外部設計書 08章 8-2) and checks it (R3-4, R3-8, R3-9; ME4xx).
// Pure functions: no files, no database. What depends on today's date or on other files
// (past months, the closing day, two files for one class) is in timetable-import.ts.

export type ImportMasters = {
  /** Every class, active or not (an inactive one is a warning, R3-9). */
  classes: {
    name: string;
    homeRoom: string;
    startYear: number;
    endYear: number | null;
    active: boolean;
  }[];
  subjects: { name: string; active: boolean }[];
  teachers: { name: string; active: boolean }[];
  rooms: { name: string; active: boolean }[];
};

export type ImportIssue = {
  level: "error" | "warning" | "info";
  /** ME4xx / MW4xx / MI4xx of 10章 */
  code: string;
  /** Line of the file (the heading is line 1). null: about the whole file. */
  line: number | null;
  message: string;
};

export type ParsedLesson = {
  date: string;
  startMinutes: number;
  endMinutes: number;
  periodNo: PeriodNo;
  subject: string;
  /** Empty: 各担当 */
  teachers: string[];
  /** null: 教室未定 */
  room: string | null;
};

export type ParsedClosure = { date: string; name: string };

export type ParsedTimetable = {
  className: string;
  /** "YYYY-MM" */
  month: string;
  /** The last day of the month. */
  lastInputDate: string;
  /** null: no provisional timetable for the next month (always null for March, R3-4). */
  nextLastInputDate: string | null;
  /** Dates of the month, and (provisional) 1st to 11th of the next month. */
  lessons: ParsedLesson[];
  closures: ParsedClosure[];
  /** Rows of April in a March file, which are not read (R3-4). */
  skippedRows: number;
};

export type ParsedFile = {
  parsed: ParsedTimetable | null;
  /** Known even when something is wrong, for the result list. */
  className: string | null;
  /** "YYYY-MM" */
  month: string | null;
  issues: ImportIssue[];
};

/** 08章 8-2: at most 1,000 rows in a file (ME418). */
export const MAX_FILE_ROWS = 1000;

const REQUIRED_COLUMNS = [
  "クラス",
  "日付",
  "開始",
  "終了",
  "科目",
  "教室",
  "区分",
  "当月の最終入力日",
  "対象年月",
  "ホームルーム教室",
] as const;

const KINDS = ["固定", "教室未定", "休み・行事", "授業なし"] as const;
const MAX_CLOSURE_NAME = 20; // 14-1 #11
const BANNED_TEACHER = "外部講師";

function norm(value: string | undefined): string {
  return (value ?? "").replaceAll("　", " ").replaceAll(" ", " ").trim();
}

function parseTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [hour, minute] = [Number(match[1]), Number(match[2])];
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

function periodOf(start: number, end: number): PeriodNo | null {
  return (
    PERIODS.find(
      (period) =>
        toMinutes(period.start) === start && toMinutes(period.end) === end,
    )?.no ?? null
  );
}

const lastDayOf = (month: string) => addDays(`${addMonths(month, 1)}-01`, -1);
const dayText = (date: string) =>
  `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

export function parseTimetableFile(
  bytes: Uint8Array,
  masters: ImportMasters,
): ParsedFile {
  const issues: ImportIssue[] = [];
  const add = (
    level: ImportIssue["level"],
    code: string,
    line: number | null,
    message: string,
  ) => issues.push({ level, code, line, message });
  const error = (code: string, line: number | null, message: string) =>
    add("error", code, line, message);
  let className: string | null = null;
  let month: string | null = null;
  const fail = (): ParsedFile => ({ parsed: null, className, month, issues });

  // ---- 読む (ME401, ME402, ME418) --------------------------------------------------
  let text: string;
  try {
    // The decoder drops a byte order mark; with or without one is fine (08章 8-1).
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    error("ME401", null, MESSAGES.ME401);
    return fail();
  }
  const grid = Papa.parse<string[]>(text, {
    delimiter: ",",
    skipEmptyLines: false,
  });
  if (grid.errors.some((e) => e.type === "Quotes")) {
    error("ME401", null, MESSAGES.ME401);
    return fail();
  }
  const heading = (grid.data[0] ?? []).map(norm);
  const missing = REQUIRED_COLUMNS.filter((name) => !heading.includes(name));
  if (missing.length > 0) {
    error("ME402", 1, MESSAGES.ME402(missing.join("、")));
    return fail();
  }
  const rows = grid.data
    .slice(1)
    .map((cells, index) => ({ line: index + 2, cells }))
    .filter((row) => row.cells.some((cell) => norm(cell) !== ""));
  if (rows.length > MAX_FILE_ROWS) {
    error("ME418", null, MESSAGES.ME418);
    return fail();
  }
  const col = (name: string) => heading.indexOf(name);
  const index = Object.fromEntries(
    [...REQUIRED_COLUMNS, "講師", "翌月の最終入力日"].map((n) => [n, col(n)]),
  ) as Record<string, number>;
  const cell = (row: { cells: string[] }, name: string) =>
    index[name] < 0 ? "" : norm(row.cells[index[name]]);

  // ---- ファイル全体で同じ値 (ME403, ME414) ----------------------------------------------
  const distinct = (name: string) => [
    ...new Set(rows.map((r) => cell(r, name))),
  ];
  const classes = distinct("クラス");
  const months = distinct("対象年月");
  const lastInputs = distinct("当月の最終入力日");
  const nextLastInputs = distinct("翌月の最終入力日");
  if (
    classes.length > 1 ||
    months.length > 1 ||
    lastInputs.length > 1 ||
    nextLastInputs.length > 1
  ) {
    error("ME403", null, MESSAGES.ME403);
  }
  if (rows.length === 0) {
    error("ME414", 2, MESSAGES.ME414(2, "データ", "(行がありません)"));
    return fail();
  }
  const first = rows[0];
  className = classes[0] === "" ? null : classes[0];
  if (className === null) {
    error("ME414", first.line, MESSAGES.ME414(first.line, "クラス", ""));
  }
  const monthText = months[0];
  if (
    /^\d{6}$/.test(monthText) &&
    +monthText.slice(4) >= 1 &&
    +monthText.slice(4) <= 12
  ) {
    month = `${monthText.slice(0, 4)}-${monthText.slice(4)}`;
  } else {
    error(
      "ME414",
      first.line,
      MESSAGES.ME414(first.line, "対象年月", monthText),
    );
  }
  if (className === null || month === null) return fail();

  // ---- クラスとホームルーム教室 (ME409, MW401, ME410) -----------------------------------
  const classMaster = masters.classes.find((item) => item.name === className);
  if (classMaster === undefined) {
    error("ME409", first.line, MESSAGES.ME409(className, "クラス", first.line));
  } else if (!classMaster.active) {
    add(
      "warning",
      "MW401",
      first.line,
      MESSAGES.MW401("クラス", className, first.line),
    );
  }
  if (classMaster !== undefined) {
    const bad = rows.find(
      (r) =>
        normalizeRoomName(cell(r, "ホームルーム教室")) !== classMaster.homeRoom,
    );
    if (bad) {
      error(
        "ME410",
        bad.line,
        MESSAGES.ME410(
          normalizeRoomName(cell(bad, "ホームルーム教室")),
          classMaster.homeRoom,
        ),
      );
    }
  }

  // ---- 最終入力日 (ME411, ME414) ----------------------------------------------------
  const monthEnd = lastDayOf(month);
  const nextMonth = addMonths(month, 1);
  const isMarch = month.endsWith("-03");
  const lastInput = lastInputs[0];
  if (!isSchoolDate(lastInput)) {
    error(
      "ME414",
      first.line,
      MESSAGES.ME414(first.line, "当月の最終入力日", lastInput),
    );
  } else if (lastInput !== monthEnd) {
    error("ME411", null, MESSAGES.ME411(dayText(lastInput)));
  }
  let nextLastInput: string | null = null;
  const nextLastText = nextLastInputs[0];
  if (nextLastText !== "" && !isMarch) {
    if (
      !isSchoolDate(nextLastText) ||
      nextLastText < `${nextMonth}-01` ||
      nextLastText > `${nextMonth}-11`
    ) {
      error(
        "ME414",
        first.line,
        MESSAGES.ME414(first.line, "翌月の最終入力日", nextLastText),
      );
    } else {
      nextLastInput = nextLastText;
    }
  }

  // ---- 行ごと ---------------------------------------------------------------------
  const lessons: ParsedLesson[] = [];
  const closures: ParsedClosure[] = [];
  const seenStart = new Set<string>();
  const reported = new Set<string>();
  let skippedRows = 0;

  /** ME409 / MW401 once for each name, at its first line. */
  function lookup(
    list: { name: string; active: boolean }[],
    value: string,
    kind: string,
    line: number,
  ): void {
    const key = `${kind}|${value}`;
    if (reported.has(key)) return;
    const found = list.find((item) => item.name === value);
    if (found === undefined) {
      reported.add(key);
      error("ME409", line, MESSAGES.ME409(value, kind, line));
    } else if (!found.active) {
      reported.add(key);
      add("warning", "MW401", line, MESSAGES.MW401(kind, value, line));
    }
  }

  for (const row of rows) {
    const { line } = row;
    const date = cell(row, "日付");
    const kind = cell(row, "区分");
    if (!(KINDS as readonly string[]).includes(kind)) {
      error("ME414", line, MESSAGES.ME414(line, "区分", kind));
      continue;
    }
    if (!isSchoolDate(date)) {
      error("ME414", line, MESSAGES.ME414(line, "日付", date));
      continue;
    }
    if (kind === "授業なし") continue;

    // R3-4: the April part of a March file is neither saved nor checked.
    if (isMarch && date >= `${nextMonth}-01` && date <= `${nextMonth}-11`) {
      skippedRows++;
      continue;
    }
    if (!(
      (date >= `${month}-01` && date <= monthEnd) ||
      (date >= `${nextMonth}-01` && date <= `${nextMonth}-11`)
    )) {
      error("ME417", line, MESSAGES.ME417(line));
      continue;
    }

    const subject = cell(row, "科目");
    if (kind === "休み・行事") {
      if (subject === "" || [...subject].length > MAX_CLOSURE_NAME) {
        error("ME414", line, MESSAGES.ME414(line, "科目", subject));
        continue;
      }
      closures.push({ date, name: subject });
      continue;
    }

    // 固定 / 教室未定: a lesson.
    if (subject === "") {
      error("ME414", line, MESSAGES.ME414(line, "科目", subject));
      continue;
    }
    lookup(masters.subjects, subject, "教科", line);

    const startText = cell(row, "開始");
    const endText = cell(row, "終了");
    const start = parseTime(startText);
    const end = parseTime(endText);
    let periodNo: PeriodNo | null = null;
    if (start === null) {
      error("ME414", line, MESSAGES.ME414(line, "開始", startText));
    } else if (end === null) {
      error("ME414", line, MESSAGES.ME414(line, "終了", endText));
    } else if (start >= end) {
      error("ME416", line, MESSAGES.ME416(line));
    } else {
      periodNo = periodOf(start, end);
      if (periodNo === null) error("ME419", line, MESSAGES.ME419(line));
    }
    if (start !== null) {
      const key = `${date}|${start}`;
      if (seenStart.has(key)) error("ME415", line, MESSAGES.ME415(line));
      seenStart.add(key);
    }

    const teacherText = cell(row, "講師");
    const teachers: string[] = [];
    for (const name of teacherText
      .split("、")
      .map(norm)
      .filter((n) => n !== "")) {
      if (name === BANNED_TEACHER) {
        error("ME413", line, MESSAGES.ME413(line));
      } else {
        lookup(masters.teachers, name, "講師", line);
        if (!teachers.includes(name)) teachers.push(name);
      }
    }

    const roomText = normalizeRoomName(cell(row, "教室"));
    let room: string | null = null;
    if (kind === "教室未定") {
      if (roomText !== ROOM_TBD) {
        error("ME414", line, MESSAGES.ME414(line, "教室", roomText));
      }
    } else if (roomText === "" || roomText === ROOM_TBD) {
      error("ME414", line, MESSAGES.ME414(line, "教室", roomText));
    } else {
      room = roomText;
      lookup(masters.rooms, roomText, "教室", line);
    }

    if (start !== null && end !== null && periodNo !== null) {
      lessons.push({
        date,
        startMinutes: start,
        endMinutes: end,
        periodNo,
        subject,
        teachers,
        room,
      });
    }
  }
  if (skippedRows > 0) add("info", "MI401", null, MESSAGES.MI401);

  // ---- 授業も名目もない平日 (ME412, R3-8) -----------------------------------------------
  // A month without any lesson is not checked (all days off). Neither is the April part of March.
  if (lessons.length > 0) {
    const named = new Set([
      ...lessons.map((l) => l.date),
      ...closures.map((c) => c.date),
    ]);
    const empty: string[] = [];
    const last = nextLastInput ?? `${nextMonth}-00`;
    for (let day = `${month}-01`; day <= last; day = addDays(day, 1)) {
      const weekday = weekdayOf(day);
      if (weekday >= 1 && weekday <= 5 && !named.has(day)) empty.push(day);
    }
    if (empty.length > 0) {
      const shown = empty.slice(0, 8).map(dayText).join("、");
      error(
        "ME412",
        null,
        MESSAGES.ME412(
          empty.length > 8 ? `${shown}、ほか${empty.length - 8}日` : shown,
        ),
      );
    }
  }

  if (issues.some((i) => i.level === "error")) return fail();
  return {
    parsed: {
      className,
      month,
      lastInputDate: monthEnd,
      nextLastInputDate: nextLastInput,
      lessons,
      closures,
      skippedRows,
    },
    className,
    month,
    issues,
  };
}
