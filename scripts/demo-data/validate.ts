// Checks generated (or hand-edited) demo files against 外部設計書 08章 and 07章.
// It reads the CSV text only, so it also works on files somebody changed by hand.
// Returns a list of problems; an empty list means everything passed.

import { readCsv } from "./csv";

const PERIOD_PAIRS = new Set([
  "9:15-10:45",
  "11:00-12:30",
  "13:30-15:00",
  "15:15-16:45",
]);
const WEEKDAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];
const KINDS = new Set(["固定", "教室未定", "休み・行事"]);
const ROOM_KINDS = new Set(["ホームルーム", "空き教室"]);
const TBD_ROOM = "ー";
const EACH_TEACHER = "各担当";

const MASTER_LIMIT = 100;
const LINK_LIMIT = 1000;
const EVENT_LIMIT = 200;
const TIMETABLE_LIMIT = 1000;

// Demo rule (not from the spec): subjects per grade shrink like at a university.
const SUBJECTS_PER_GRADE: Record<number, number> = { 1: 8, 2: 7, 3: 5, 4: 2 };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function weekdayOf(value: string): number {
  return new Date(`${value}T00:00:00Z`).getUTCDay();
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthEnd(yearMonth: string): string {
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(4, 6));
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function nextMonth(yearMonth: string): string {
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(4, 6));
  return month === 12
    ? `${year + 1}01`
    : `${year}${String(month + 1).padStart(2, "0")}`;
}

const iso = (yearMonth: string) => `${yearMonth.slice(0, 4)}-${yearMonth.slice(4, 6)}`;

type Table = { header: string[]; rows: string[][] };

function readTable(
  files: Map<string, string>,
  path: string,
  header: string[],
  problems: string[],
): Table | null {
  const text = files.get(path);
  if (text === undefined) {
    problems.push(`${path}: file is missing`);
    return null;
  }
  if (!text.startsWith("﻿")) problems.push(`${path}: no BOM`);
  if (/(^|[^\r])\n/.test(text)) problems.push(`${path}: line ends must be CRLF`);
  const all = readCsv(text);
  if (all.length === 0 || all[0].join(",") !== header.join(",")) {
    problems.push(`${path}: header must be ${header.join(",")}`);
    return null;
  }
  const rows = all.slice(1);
  rows.forEach((row, index) => {
    if (row.length !== header.length) {
      problems.push(`${path}: line ${index + 2} has ${row.length} columns`);
    }
  });
  return { header, rows: rows.filter((row) => row.length === header.length) };
}

function checkUnique(path: string, label: string, values: string[], problems: string[]) {
  const seen = new Set<string>();
  for (const value of values) {
    if (value.trim() === "") problems.push(`${path}: empty ${label}`);
    if (value !== value.trim()) problems.push(`${path}: ${label} "${value}" has spaces at an end`);
    if (seen.has(value)) problems.push(`${path}: duplicate ${label} "${value}"`);
    seen.add(value);
  }
}

type Master = {
  classes: Map<string, string>; // name -> home room
  teachers: Set<string>;
  subjects: Set<string>;
  rooms: Map<string, string>; // name -> kind
  classSubjects: Set<string>; // "class|subject"
  events: { start: string; end: string; name: string; className: string }[];
};

function readMaster(files: Map<string, string>, problems: string[]): Master | null {
  const classes = readTable(files, "master/クラスマスタ.csv", ["クラス名", "ホームルーム教室"], problems);
  const teachers = readTable(files, "master/講師マスタ.csv", ["時間割での表記"], problems);
  const subjects = readTable(files, "master/教科マスタ.csv", ["教科名"], problems);
  const rooms = readTable(files, "master/教室マスタ.csv", ["教室名", "棟・階", "分類", "備考"], problems);
  const classSubjects = readTable(files, "master/紐づけ_クラスの教科.csv", ["クラス", "教科"], problems);
  const subjectTeachers = readTable(files, "master/紐づけ_教科の講師.csv", ["クラス", "教科", "講師"], problems);
  const subjectRooms = readTable(files, "master/紐づけ_教科の教室.csv", ["クラス", "教科", "教室"], problems);
  const events = readTable(files, "master/休み・行事.csv", ["開始日", "終了日", "名称", "対象クラス"], problems);
  if (!classes || !teachers || !subjects || !rooms || !classSubjects || !subjectTeachers || !subjectRooms || !events) {
    return null;
  }

  for (const [path, table, limit] of [
    ["master/クラスマスタ.csv", classes, MASTER_LIMIT],
    ["master/講師マスタ.csv", teachers, MASTER_LIMIT],
    ["master/教科マスタ.csv", subjects, MASTER_LIMIT],
    ["master/教室マスタ.csv", rooms, MASTER_LIMIT],
    ["master/紐づけ_クラスの教科.csv", classSubjects, LINK_LIMIT],
    ["master/紐づけ_教科の講師.csv", subjectTeachers, LINK_LIMIT],
    ["master/紐づけ_教科の教室.csv", subjectRooms, LINK_LIMIT],
    ["master/休み・行事.csv", events, EVENT_LIMIT],
  ] as const) {
    if (table.rows.length > limit) problems.push(`${path}: more than ${limit} rows`);
  }

  checkUnique("master/クラスマスタ.csv", "class", classes.rows.map((r) => r[0]), problems);
  checkUnique("master/講師マスタ.csv", "teacher", teachers.rows.map((r) => r[0]), problems);
  checkUnique("master/教科マスタ.csv", "subject", subjects.rows.map((r) => r[0]), problems);
  checkUnique("master/教室マスタ.csv", "room", rooms.rows.map((r) => r[0]), problems);

  for (const [name] of teachers.rows) {
    if (name === EACH_TEACHER || name === "外部講師") problems.push(`講師マスタ: "${name}" is not allowed (ME503)`);
    if (name.includes("、")) problems.push(`講師マスタ: "${name}" contains 、 (ME503)`);
  }
  for (const [name, , kind] of rooms.rows) {
    if (!ROOM_KINDS.has(kind)) problems.push(`教室マスタ: ${name} has the 分類 "${kind}"`);
    if (/[０-９]/.test(name)) problems.push(`教室マスタ: ${name} has full-width digits`);
  }

  const roomKinds = new Map(rooms.rows.map((r) => [r[0], r[2]]));
  const classHome = new Map(classes.rows.map((r) => [r[0], r[1]]));
  const seenHome = new Set<string>();
  for (const [name, home] of classes.rows) {
    if (roomKinds.get(home) !== "ホームルーム") problems.push(`クラスマスタ: ${name}'s room "${home}" is not a ホームルーム room (R5-6 #1)`);
    if (seenHome.has(home)) problems.push(`クラスマスタ: home room "${home}" is used twice (R5-6 #2)`);
    seenHome.add(home);
  }
  if (classes.rows.length !== 12) problems.push(`クラスマスタ: expected 12 classes, got ${classes.rows.length}`);

  const teacherSet = new Set(teachers.rows.map((r) => r[0]));
  const subjectSet = new Set(subjects.rows.map((r) => r[0]));
  const classSubjectSet = new Set<string>();
  for (const [className, subject] of classSubjects.rows) {
    const key = `${className}|${subject}`;
    if (!classHome.has(className)) problems.push(`紐づけ_クラスの教科: unknown class "${className}"`);
    if (!subjectSet.has(subject)) problems.push(`紐づけ_クラスの教科: unknown subject "${subject}"`);
    if (classSubjectSet.has(key)) problems.push(`紐づけ_クラスの教科: duplicate ${className} ${subject} (ME506)`);
    classSubjectSet.add(key);
  }

  // Demo rule: subjects per grade.
  for (const className of classHome.keys()) {
    const grade = Number(className.match(/(\d)年$/)?.[1]);
    const count = [...classSubjectSet].filter((k) => k.startsWith(`${className}|`)).length;
    if (SUBJECTS_PER_GRADE[grade] !== count) {
      problems.push(`${className}: expected ${SUBJECTS_PER_GRADE[grade]} subjects, got ${count}`);
    }
  }
  for (const subject of subjectSet) {
    if (![...classSubjectSet].some((k) => k.endsWith(`|${subject}`))) {
      problems.push(`教科マスタ: "${subject}" is not used by any class`);
    }
  }
  for (const teacher of teacherSet) {
    if (!subjectTeachers.rows.some((r) => r[2] === teacher)) {
      problems.push(`講師マスタ: "${teacher}" teaches nothing`);
    }
  }

  const teacherRowsOf = new Map<string, number>();
  const seenTeacherRows = new Set<string>();
  for (const [className, subject, teacher] of subjectTeachers.rows) {
    const key = `${className}|${subject}`;
    if (!classSubjectSet.has(key)) problems.push(`紐づけ_教科の講師: ${className} ${subject} is not in クラスの教科 (R5-6 #4)`);
    if (teacher !== EACH_TEACHER && !teacherSet.has(teacher)) problems.push(`紐づけ_教科の講師: unknown teacher "${teacher}"`);
    if (seenTeacherRows.has(`${key}|${teacher}`)) problems.push(`紐づけ_教科の講師: duplicate ${key} ${teacher}`);
    seenTeacherRows.add(`${key}|${teacher}`);
    teacherRowsOf.set(key, (teacherRowsOf.get(key) ?? 0) + 1);
  }
  const roomRowsOf = new Set<string>();
  for (const [className, subject, room] of subjectRooms.rows) {
    const key = `${className}|${subject}`;
    if (!classSubjectSet.has(key)) problems.push(`紐づけ_教科の教室: ${className} ${subject} is not in クラスの教科 (R5-6 #4)`);
    if (room !== TBD_ROOM && !roomKinds.has(room)) problems.push(`紐づけ_教科の教室: unknown room "${room}"`);
    if (roomRowsOf.has(key)) problems.push(`紐づけ_教科の教室: duplicate ${key}`);
    roomRowsOf.add(key);
  }
  for (const key of classSubjectSet) {
    if (!teacherRowsOf.has(key)) problems.push(`紐づけ_教科の講師: ${key} has no teacher row (R5-6 #3)`);
  }

  const eventList: Master["events"] = [];
  const seenEvents = new Set<string>();
  for (const [start, end, name, className] of events.rows) {
    if (!isRealDate(start)) problems.push(`休み・行事: bad start date "${start}"`);
    if (end !== "" && !isRealDate(end)) problems.push(`休み・行事: bad end date "${end}"`);
    if (end !== "" && end < start) problems.push(`休み・行事: ${name} ends before it starts`);
    if (name.trim() === "") problems.push("休み・行事: empty name");
    if (className !== "" && !classHome.has(className)) problems.push(`休み・行事: unknown class "${className}"`);
    const key = `${start}|${end}|${name}|${className}`;
    if (seenEvents.has(key)) problems.push(`休み・行事: duplicate row ${key}`);
    seenEvents.add(key);
    eventList.push({ start, end: end || start, name, className });
  }

  return {
    classes: classHome,
    teachers: teacherSet,
    subjects: subjectSet,
    rooms: roomKinds,
    classSubjects: classSubjectSet,
    events: eventList,
  };
}

const TIMETABLE_HEADER = [
  "クラス", "日付", "曜日", "時限", "開始", "終了", "科目", "講師", "教室",
  "区分", "当月の最終入力日", "翌月の最終入力日", "対象年月", "ホームルーム教室",
];

type Lesson = { className: string; date: string; start: string; subject: string; teachers: string; room: string };

function checkTimetable(
  path: string,
  className: string,
  yearMonth: string,
  table: Table,
  master: Master,
  problems: string[],
): { lessons: Lesson[]; ownMonth: Lesson[] } {
  const where = (line: number) => `${path}: line ${line + 2}`;
  const end = monthEnd(yearMonth);
  const hasNext = yearMonth !== "202703";
  const lastNext = hasNext ? `${iso(nextMonth(yearMonth))}-11` : "";
  const lastDate = lastNext || end;
  const first = `${iso(yearMonth)}-01`;

  if (table.rows.length > TIMETABLE_LIMIT) problems.push(`${path}: more than ${TIMETABLE_LIMIT} rows (ME418)`);
  if (!master.classes.has(className)) problems.push(`${path}: class "${className}" is not in the master (ME409)`);

  const lessons: Lesson[] = [];
  const eventNames = new Map<string, Set<string>>(); // date -> names
  const seenStart = new Set<string>();

  table.rows.forEach((row, index) => {
    const [cls, date, weekday, , start, finish, subject, teachers, room, kind, lastInput, nextInput, target, home] = row;
    if (cls !== className) problems.push(`${where(index)}: class "${cls}" differs from the file (ME403)`);
    if (target !== yearMonth) problems.push(`${where(index)}: 対象年月 ${target} differs (ME403)`);
    if (lastInput !== end) problems.push(`${where(index)}: 当月の最終入力日 must be ${end} (ME411)`);
    if (nextInput !== lastNext) problems.push(`${where(index)}: 翌月の最終入力日 must be "${lastNext}"`);
    if (home !== master.classes.get(className)) problems.push(`${where(index)}: ホームルーム教室 differs from the master (ME410)`);
    if (!isRealDate(date)) {
      problems.push(`${where(index)}: bad date "${date}" (ME414)`);
      return;
    }
    if (date < first || date > lastDate) problems.push(`${where(index)}: ${date} is out of range (ME417)`);
    if (weekday !== WEEKDAY_NAMES[weekdayOf(date)]) problems.push(`${where(index)}: 曜日 does not match ${date}`);
    if (!KINDS.has(kind)) {
      problems.push(`${where(index)}: bad 区分 "${kind}" (ME414)`);
      return;
    }

    if (kind === "休み・行事") {
      if (start || finish || teachers || room) problems.push(`${where(index)}: 休み・行事 row must have empty time, teacher and room`);
      if (subject.trim() === "") problems.push(`${where(index)}: 休み・行事 row has no name`);
      const names = eventNames.get(date) ?? new Set<string>();
      if (names.has(subject)) problems.push(`${where(index)}: duplicate event "${subject}" on ${date}`);
      names.add(subject);
      eventNames.set(date, names);
      return;
    }

    if (!PERIOD_PAIRS.has(`${start}-${finish}`)) problems.push(`${where(index)}: ${start}-${finish} is not one of the four periods (ME419)`);
    if (!master.subjects.has(subject)) problems.push(`${where(index)}: subject "${subject}" is not in the master (ME409)`);
    for (const teacher of teachers === "" ? [] : teachers.split("、")) {
      if (teacher === "外部講師") problems.push(`${where(index)}: 外部講師 is not allowed (ME413)`);
      else if (!master.teachers.has(teacher)) problems.push(`${where(index)}: teacher "${teacher}" is not in the master (ME409)`);
    }
    if (kind === "固定" && (room === TBD_ROOM || !master.rooms.has(room))) problems.push(`${where(index)}: room "${room}" is not in the master (ME409)`);
    if (kind === "教室未定" && room !== TBD_ROOM) problems.push(`${where(index)}: 教室未定 row must have "${TBD_ROOM}" as the room`);
    if (!master.classSubjects.has(`${className}|${subject}`)) problems.push(`${where(index)}: ${className} does not take "${subject}" (warning level in the tool)`);

    const startKey = `${date}|${start}`;
    if (seenStart.has(startKey)) problems.push(`${where(index)}: two lessons at ${date} ${start} (ME415)`);
    seenStart.add(startKey);
    lessons.push({ className, date, start, subject, teachers, room: kind === "固定" ? room : "" });
  });

  // No weekday without a lesson or an event name (ME412).
  const lessonDates = new Set(lessons.map((l) => l.date));
  for (let date = first; date <= lastDate; date = addDays(date, 1)) {
    const weekday = weekdayOf(date);
    if (weekday === 0 || weekday === 6) continue;
    if (!lessonDates.has(date) && !eventNames.has(date)) problems.push(`${path}: ${date} has no lesson and no event name (ME412)`);
  }

  // Every event of CSV-08 that applies to this class must be in the file.
  for (const event of master.events) {
    if (event.className !== "" && event.className !== className) continue;
    for (let date = event.start; date <= event.end; date = addDays(date, 1)) {
      if (date < first || date > lastDate) continue;
      if (!eventNames.get(date)?.has(event.name)) problems.push(`${path}: event "${event.name}" on ${date} is missing`);
    }
  }

  return { lessons, ownMonth: lessons.filter((l) => l.date <= end) };
}

export function validateFiles(files: Map<string, string>): string[] {
  const problems: string[] = [];
  const master = readMaster(files, problems);
  if (!master) return problems;

  const perFile = new Map<string, { lessons: Lesson[]; ownMonth: Lesson[] }>();
  for (const path of [...files.keys()].filter((p) => p.startsWith("timetable/"))) {
    const match = path.match(/^timetable\/(\d{6})\/(.+)_(\d{6})_取込用\.csv$/);
    if (!match || match[1] !== match[3]) {
      problems.push(`${path}: bad file name or folder`);
      continue;
    }
    const table = readTable(files, path, TIMETABLE_HEADER, problems);
    if (!table) continue;
    perFile.set(`${match[2]}|${match[3]}`, checkTimetable(path, match[2], match[3], table, master, problems));
  }

  // Every class has a file for every month, and no class×month twice (ME404 cannot happen by name).
  const months = [...new Set([...perFile.keys()].map((k) => k.split("|")[1]))].sort();
  for (const className of master.classes.keys()) {
    for (const month of months) {
      if (!perFile.has(`${className}|${month}`)) problems.push(`${className} ${month}: file is missing`);
    }
  }

  // The 翌月1〜11日 part must agree with the next month's own file.
  for (const [key, data] of perFile) {
    const [className, month] = key.split("|");
    const next = perFile.get(`${className}|${nextMonth(month)}`);
    if (!next) continue;
    const limit = `${iso(nextMonth(month))}-11`;
    const provisional = data.lessons.filter((l) => l.date > monthEnd(month)).map(lessonKey).sort();
    const real = next.ownMonth.filter((l) => l.date <= limit).map(lessonKey).sort();
    if (provisional.join("\n") !== real.join("\n")) {
      problems.push(`${className}: the 翌月1〜11日 part of ${month} differs from the file of ${nextMonth(month)}`);
    }
  }

  // Nobody is in two places at once, and no room is used by two classes (統合ツールの赤).
  const teacherUse = new Map<string, string>();
  const roomUse = new Map<string, string>();
  for (const [key, data] of perFile) {
    const className = key.split("|")[0];
    for (const lesson of data.ownMonth) {
      const slot = `${lesson.date}|${lesson.start}`;
      for (const teacher of lesson.teachers === "" ? [] : lesson.teachers.split("、")) {
        const other = teacherUse.get(`${teacher}|${slot}`);
        if (other !== undefined && other !== className) problems.push(`${teacher} teaches ${other} and ${className} at ${slot}`);
        teacherUse.set(`${teacher}|${slot}`, className);
      }
      if (lesson.room !== "") {
        const other = roomUse.get(`${lesson.room}|${slot}`);
        if (other !== undefined && other !== className) problems.push(`room ${lesson.room} is used by ${other} and ${className} at ${slot}`);
        roomUse.set(`${lesson.room}|${slot}`, className);
      }
    }
  }

  return problems;
}

function lessonKey(lesson: Lesson): string {
  return [lesson.className, lesson.date, lesson.start, lesson.subject, lesson.teachers, lesson.room].join("|");
}
