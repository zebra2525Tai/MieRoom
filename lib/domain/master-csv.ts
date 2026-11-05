import Papa from "papaparse";
import { isSchoolDate } from "./school-date";

// Reads the 8 master CSVs (外部設計書 08章 8-3, the same files the system writes for the
// Excel tool) and checks them against the master rules (R5-1, R5-5, R5-6, 14-1 #11).
// Pure functions: no files, no database, so every rule can be tested on its own.

export const MASTER_FILES = {
  classes: "クラスマスタ.csv",
  teachers: "講師マスタ.csv",
  subjects: "教科マスタ.csv",
  rooms: "教室マスタ.csv",
  classSubjects: "紐づけ_クラスの教科.csv",
  subjectTeachers: "紐づけ_教科の講師.csv",
  subjectRooms: "紐づけ_教科の教室.csv",
  closures: "休み・行事.csv",
} as const;

export type MasterFileKey = keyof typeof MASTER_FILES;
export type MasterFileTexts = Record<MasterFileKey, string>;

const HEADERS: Record<MasterFileKey, string[]> = {
  classes: ["クラス名", "ホームルーム教室"],
  teachers: ["時間割での表記"],
  subjects: ["教科名"],
  rooms: ["教室名", "棟・階", "分類", "備考"],
  classSubjects: ["クラス", "教科"],
  subjectTeachers: ["クラス", "教科", "講師"],
  subjectRooms: ["クラス", "教科", "教室"],
  closures: ["開始日", "終了日", "名称", "対象クラス"],
};

/** Longest allowed texts (14-1 #11, S21). A full-width and a half-width letter both count 1. */
const MAX = {
  className: 30,
  teacherName: 20,
  subjectName: 30,
  roomName: 20,
  building: 20,
  roomNote: 50,
  closureName: 20,
} as const;

/** Row limits of the Excel tool's tables (R5-6 の7, R5-6 の6). */
const MAX_ROWS = { master: 100, link: 1000, closure: 200 } as const;
const CLOSURE_WARN_ROWS = 180;

/** 「各担当」 (no fixed teacher) and 「ー」 (room not decided yet) in the link files. */
export const ANY_TEACHER = "各担当";
export const ROOM_TBD = "ー";

const ROOM_KINDS = { ホームルーム: "HOMEROOM", 空き教室: "FREE" } as const;

export type MasterData = {
  rooms: {
    name: string;
    building: string | null;
    kind: "HOMEROOM" | "FREE";
    note: string | null;
  }[];
  teachers: { displayName: string }[];
  subjects: { name: string }[];
  classes: { name: string; homeRoom: string }[];
  classSubjects: { className: string; subjectName: string }[];
  /** teacherName null = 各担当 */
  subjectTeachers: {
    className: string;
    subjectName: string;
    teacherName: string | null;
  }[];
  /** roomName null = 教室未定 */
  subjectRooms: {
    className: string;
    subjectName: string;
    roomName: string | null;
  }[];
  /** endDate null = one day only; className null = the whole school */
  closures: {
    startDate: string;
    endDate: string | null;
    name: string;
    className: string | null;
  }[];
};

export type MasterIssue = {
  level: "error" | "warning";
  /** Message id from 外部設計書 10章 where there is one, else the rule number. */
  code: string;
  message: string;
};

const length = (value: string) => [...value].length;

/** Room names are written with half-width digits (R5-1, the same as the Excel tool). */
function normalizeRoomName(value: string): string {
  return value.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}

type Row = Record<string, string>;

export function buildMasterData(files: MasterFileTexts): {
  data: MasterData | null;
  issues: MasterIssue[];
} {
  const issues: MasterIssue[] = [];
  const error = (code: string, message: string) =>
    issues.push({ level: "error", code, message });

  function readTable(key: MasterFileKey): Row[] {
    const name = MASTER_FILES[key];
    const parsed = Papa.parse<Row>(files[key], {
      header: true,
      delimiter: ",",
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      transform: (v) => v.trim(),
    });
    const fields = parsed.meta.fields ?? [];
    const missing = HEADERS[key].filter((h) => !fields.includes(h));
    if (missing.length > 0) {
      error("ME402", `${name}: 必須の列がありません(${missing.join("、")})`);
      return [];
    }
    for (const e of parsed.errors) {
      error(
        "ME414",
        `${name} ${(e.row ?? 0) + 2}行目: CSV の形式が正しくありません`,
      );
    }
    return parsed.data;
  }

  const tables = {} as Record<MasterFileKey, Row[]>;
  for (const key of Object.keys(MASTER_FILES) as MasterFileKey[]) {
    tables[key] = readTable(key);
  }
  const at = (key: MasterFileKey, index: number) =>
    `${MASTER_FILES[key]} ${index + 2}行目`;

  /** A required text of at most `max` characters; null (and an error) otherwise. */
  function required(
    key: MasterFileKey,
    index: number,
    label: string,
    value: string,
    max: number,
  ): string | null {
    if (value === "") {
      error("R5-1", `${at(key, index)}: ${label}が空です`);
      return null;
    }
    if (length(value) > max) {
      error("R5-1", `${at(key, index)}: ${label}は${max}文字までです`);
      return null;
    }
    return value;
  }

  function checkRowCount(key: MasterFileKey, max: number) {
    if (tables[key].length > max) {
      error(
        "ME510",
        `${MASTER_FILES[key]}: ${max}行までです(${tables[key].length}行)`,
      );
    }
  }
  for (const key of ["classes", "teachers", "subjects", "rooms"] as const) {
    checkRowCount(key, MAX_ROWS.master);
  }
  for (const key of [
    "classSubjects",
    "subjectTeachers",
    "subjectRooms",
  ] as const) {
    checkRowCount(key, MAX_ROWS.link);
  }
  checkRowCount("closures", MAX_ROWS.closure);
  if (
    tables.closures.length > CLOSURE_WARN_ROWS &&
    tables.closures.length <= MAX_ROWS.closure
  ) {
    issues.push({
      level: "warning",
      code: "MW503",
      message: `${MASTER_FILES.closures}: ${tables.closures.length}行です(${CLOSURE_WARN_ROWS}行を超えています)`,
    });
  }

  /** Names are unique within one kind (R5-1). Returns the set of valid names. */
  function uniqueNames(
    key: MasterFileKey,
    column: string,
    label: string,
    max: number,
    normalize: (value: string) => string = (v) => v,
    reject: (value: string) => string | null = () => null,
  ): Set<string> {
    const seen = new Set<string>();
    tables[key].forEach((row, index) => {
      const name = required(key, index, label, normalize(row[column]), max);
      if (name === null) return;
      const rejected = reject(name);
      if (rejected !== null) {
        error("ME503", `${at(key, index)}: ${rejected}`);
        return;
      }
      if (seen.has(name)) {
        error(
          "ME502",
          `${at(key, index)}: ${label}「${name}」が重複しています`,
        );
        return;
      }
      seen.add(name);
    });
    return seen;
  }

  // ---- 教室 -----------------------------------------------------------------
  const roomNames = uniqueNames(
    "rooms",
    "教室名",
    "教室名",
    MAX.roomName,
    normalizeRoomName,
    (name) => (name === ROOM_TBD ? "「ー」は教室名にできません" : null),
  );
  const rooms: MasterData["rooms"] = [];
  tables.rooms.forEach((row, index) => {
    const name = normalizeRoomName(row["教室名"]);
    if (!roomNames.has(name) || rooms.some((r) => r.name === name)) return;
    const kind = Object.hasOwn(ROOM_KINDS, row["分類"])
      ? ROOM_KINDS[row["分類"] as keyof typeof ROOM_KINDS]
      : null;
    if (kind === null) {
      error(
        "R5-1",
        `${at("rooms", index)}: 分類は「ホームルーム」か「空き教室」です`,
      );
      return;
    }
    if (length(row["棟・階"]) > MAX.building) {
      error(
        "R5-1",
        `${at("rooms", index)}: 棟・階は${MAX.building}文字までです`,
      );
      return;
    }
    if (length(row["備考"]) > MAX.roomNote) {
      error("R5-1", `${at("rooms", index)}: 備考は${MAX.roomNote}文字までです`);
      return;
    }
    rooms.push({
      name,
      building: row["棟・階"] || null,
      kind,
      note: row["備考"] || null,
    });
  });

  // ---- 講師・教科・クラス ----------------------------------------------------------
  const teacherNames = uniqueNames(
    "teachers",
    "時間割での表記",
    "時間割での表記",
    MAX.teacherName,
    (v) => v,
    (name) => {
      if (name === ANY_TEACHER || name === "外部講師") {
        return `「${name}」は講師にできません`;
      }
      return name.includes("、") ? "「、」は使えません" : null;
    },
  );
  const subjectNames = uniqueNames(
    "subjects",
    "教科名",
    "教科名",
    MAX.subjectName,
  );
  const classNames = uniqueNames(
    "classes",
    "クラス名",
    "クラス名",
    MAX.className,
  );

  const classes: MasterData["classes"] = [];
  const homeRoomOwner = new Map<string, string>();
  tables.classes.forEach((row, index) => {
    const name = row["クラス名"];
    if (!classNames.has(name) || classes.some((c) => c.name === name)) return;
    const homeRoom = normalizeRoomName(row["ホームルーム教室"]);
    if (!roomNames.has(homeRoom)) {
      error(
        "ME510",
        `${at("classes", index)}: ホームルーム教室「${homeRoom}」が教室マスタにありません(R5-6 の1)`,
      );
      return;
    }
    const other = homeRoomOwner.get(homeRoom);
    if (other !== undefined) {
      error(
        "ME510",
        `${at("classes", index)}: ホームルーム教室「${homeRoom}」が「${other}」と重なっています(R5-6 の2)`,
      );
      return;
    }
    homeRoomOwner.set(homeRoom, name);
    classes.push({ name, homeRoom });
  });

  // ---- 紐づけ (R5-5, R5-6) --------------------------------------------------------
  const classSubjects: MasterData["classSubjects"] = [];
  const classSubjectKeys = new Set<string>();
  tables.classSubjects.forEach((row, index) => {
    const [className, subjectName] = [row["クラス"], row["教科"]];
    if (!classNames.has(className) || !subjectNames.has(subjectName)) {
      error(
        "ME409",
        `${at("classSubjects", index)}: クラス「${className}」または教科「${subjectName}」がマスタにありません`,
      );
      return;
    }
    const key = `${className}\u0000${subjectName}`;
    if (classSubjectKeys.has(key)) {
      error("ME506", `${at("classSubjects", index)}: 同じ組み合わせがあります`);
      return;
    }
    classSubjectKeys.add(key);
    classSubjects.push({ className, subjectName });
  });

  const subjectTeachers: MasterData["subjectTeachers"] = [];
  const teacherKeys = new Set<string>();
  const subjectsWithTeacher = new Set<string>();
  tables.subjectTeachers.forEach((row, index) => {
    const [className, subjectName, teacher] = [
      row["クラス"],
      row["教科"],
      row["講師"],
    ];
    const pair = `${className}\u0000${subjectName}`;
    if (!classSubjectKeys.has(pair)) {
      error(
        "ME510",
        `${at("subjectTeachers", index)}: (${className}, ${subjectName}) がクラスの教科にありません(R5-6 の4)`,
      );
      return;
    }
    const teacherName = teacher === ANY_TEACHER ? null : teacher;
    if (teacherName !== null && !teacherNames.has(teacherName)) {
      error(
        "ME409",
        `${at("subjectTeachers", index)}: 講師「${teacher}」がマスタにありません(R5-6 の5)`,
      );
      return;
    }
    const key = `${pair}\u0000${teacherName ?? ""}`;
    if (teacherKeys.has(key)) {
      error(
        "ME506",
        `${at("subjectTeachers", index)}: 同じ組み合わせがあります`,
      );
      return;
    }
    teacherKeys.add(key);
    subjectsWithTeacher.add(pair);
    subjectTeachers.push({ className, subjectName, teacherName });
  });
  for (const { className, subjectName } of classSubjects) {
    if (!subjectsWithTeacher.has(`${className}\u0000${subjectName}`)) {
      error(
        "ME510",
        `「${className}」の「${subjectName}」に、講師の行がありません(R5-6 の3)`,
      );
    }
  }

  const subjectRooms: MasterData["subjectRooms"] = [];
  const roomKeys = new Set<string>();
  tables.subjectRooms.forEach((row, index) => {
    const [className, subjectName] = [row["クラス"], row["教科"]];
    const pair = `${className}\u0000${subjectName}`;
    if (!classSubjectKeys.has(pair)) {
      error(
        "ME510",
        `${at("subjectRooms", index)}: (${className}, ${subjectName}) がクラスの教科にありません(R5-6 の4)`,
      );
      return;
    }
    const room = normalizeRoomName(row["教室"]);
    const roomName = room === ROOM_TBD ? null : room;
    if (roomName !== null && !roomNames.has(roomName)) {
      error(
        "ME409",
        `${at("subjectRooms", index)}: 教室「${room}」がマスタにありません(R5-6 の5)`,
      );
      return;
    }
    const key = `${pair}\u0000${roomName ?? ""}`;
    if (roomKeys.has(key)) {
      error("ME506", `${at("subjectRooms", index)}: 同じ組み合わせがあります`);
      return;
    }
    roomKeys.add(key);
    subjectRooms.push({ className, subjectName, roomName });
  });

  // ---- 休み・行事 ---------------------------------------------------------------
  const closures: MasterData["closures"] = [];
  tables.closures.forEach((row, index) => {
    const name = required(
      "closures",
      index,
      "名称",
      row["名称"],
      MAX.closureName,
    );
    const start = row["開始日"];
    const end = row["終了日"] === "" ? null : row["終了日"];
    const className = row["対象クラス"] === "" ? null : row["対象クラス"];
    if (name === null) return;
    if (!isSchoolDate(start) || (end !== null && !isSchoolDate(end))) {
      error(
        "ME414",
        `${at("closures", index)}: 日付は YYYY-MM-DD で入れてください`,
      );
      return;
    }
    if (end !== null && end < start) {
      error("ME505", `${at("closures", index)}: 終了日が開始日より前です`);
      return;
    }
    if (className !== null && !classNames.has(className)) {
      error(
        "ME409",
        `${at("closures", index)}: 対象クラス「${className}」がマスタにありません`,
      );
      return;
    }
    closures.push({ startDate: start, endDate: end, name, className });
  });

  if (issues.some((i) => i.level === "error")) return { data: null, issues };
  return {
    data: {
      rooms,
      teachers: [...teacherNames].map((displayName) => ({ displayName })),
      subjects: [...subjectNames].map((name) => ({ name })),
      classes,
      classSubjects,
      subjectTeachers,
      subjectRooms,
      closures,
    },
    issues,
  };
}
