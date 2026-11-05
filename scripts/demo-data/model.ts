// Fictional master data and timetables for trying the 時間割作成ツール and the import.
// Everything here is made up: no real person, class or school is meant.
//
// The shapes follow 外部設計書 08章 (CSV-01〜08 and 取込用CSV) and 07章 (R3, R5).
// The result is deterministic (fixed random seed), so running it twice gives the same files.

import { writeCsv } from "./csv";

// ---- dates (UTC arithmetic only, so the machine's time zone never matters) ----

export function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number): string {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekdayOf(value: string): number {
  return parseDate(value).getUTCDay();
}

export function monthEndOf(yearMonth: string): string {
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(4, 6));
  return formatDate(new Date(Date.UTC(year, month, 0)));
}

export function nextYearMonth(yearMonth: string): string {
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(4, 6));
  return month === 12
    ? `${year + 1}01`
    : `${year}${String(month + 1).padStart(2, "0")}`;
}

function isoMonth(yearMonth: string): string {
  return `${yearMonth.slice(0, 4)}-${yearMonth.slice(4, 6)}`;
}

function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);
  return dates;
}

// ---- fixed rules (外部設計書 07章 R3-1) ----

export const PERIODS = [
  { name: "1限", start: "9:15", end: "10:45" },
  { name: "2限", start: "11:00", end: "12:30" },
  { name: "3限", start: "13:30", end: "15:00" },
  { name: "4限", start: "15:15", end: "16:45" },
] as const;

export const WEEKDAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];
export const TBD_ROOM = "ー"; // 教室未定
export const EACH_TEACHER = "各担当";

export const MONTHS = ["202611", "202612", "202701", "202702", "202703"];

// ---- classes ----

const PROGRAMS = [
  { name: "大学併修", years: 4 },
  { name: "医療情報", years: 4 },
  { name: "ゲームITエキスパート", years: 2 },
  { name: "システム専攻", years: 2 },
];

export type ClassDef = {
  name: string;
  program: string;
  grade: number;
  homeRoom: string;
};

const HOME_ROOMS: Record<string, string> = {
  大学併修1年: "A101",
  大学併修2年: "A102",
  大学併修3年: "A103",
  大学併修4年: "A104",
  医療情報1年: "B201",
  医療情報2年: "B202",
  医療情報3年: "B203",
  医療情報4年: "B204",
  ゲームITエキスパート1年: "C301",
  ゲームITエキスパート2年: "C302",
  システム専攻1年: "C303",
  システム専攻2年: "C304",
};

export const CLASSES: ClassDef[] = PROGRAMS.flatMap((program) =>
  Array.from({ length: program.years }, (_, index) => {
    const grade = index + 1;
    const name = `${program.name}${grade}年`;
    return { name, program: program.name, grade, homeRoom: HOME_ROOMS[name] };
  }),
);

// Subjects each class takes: the higher the grade, the fewer (8 / 7 / 5 / 2).
const SUBJECTS: Record<string, string[]> = {
  大学併修1: [
    "情報リテラシー",
    "プログラミング基礎",
    "英語A",
    "数学基礎",
    "日本語表現",
    "大学基礎ゼミ",
    "コンピュータ概論",
    "キャリアデザイン",
  ],
  大学併修2: [
    "プログラミング応用",
    "データ構造",
    "英語B",
    "統計学入門",
    "ネットワーク概論",
    "データベース概論",
    "大学専門ゼミA",
  ],
  大学併修3: [
    "ソフトウェア工学",
    "情報セキュリティ",
    "大学専門ゼミB",
    "システム設計演習",
    "技術英語",
  ],
  大学併修4: ["卒業研究", "卒業制作ゼミ"],
  医療情報1: [
    "情報リテラシー",
    "医療概論",
    "解剖生理学基礎",
    "英語A",
    "医療事務基礎",
    "プログラミング基礎",
    "日本語表現",
    "キャリアデザイン",
  ],
  医療情報2: [
    "医療情報システム概論",
    "診療情報管理",
    "疾病と治療",
    "データベース概論",
    "統計学入門",
    "医療倫理と個人情報",
    "医療情報演習A",
  ],
  医療情報3: [
    "医療情報演習B",
    "電子カルテ演習",
    "医療データ分析",
    "情報セキュリティ",
    "技術英語",
  ],
  医療情報4: ["卒業研究", "実習報告ゼミ"],
  ゲームITエキスパート1: [
    "情報リテラシー",
    "プログラミング基礎",
    "ゲーム企画入門",
    "2Dグラフィックス",
    "ゲームプログラミング基礎",
    "数学基礎",
    "英語A",
    "キャリアデザイン",
  ],
  ゲームITエキスパート2: [
    "ゲームプログラミング応用",
    "3Dグラフィックス",
    "ゲームエンジン演習",
    "サウンドデザイン",
    "チーム制作",
    "ゲーム企画演習",
    "ポートフォリオ制作",
  ],
  システム専攻1: [
    "情報リテラシー",
    "プログラミング基礎",
    "コンピュータ概論",
    "ネットワーク基礎",
    "数学基礎",
    "英語A",
    "Webアプリ入門",
    "キャリアデザイン",
  ],
  システム専攻2: [
    "システム開発演習",
    "データベース演習",
    "サーバー構築",
    "セキュリティ基礎",
    "プロジェクト管理",
    "チーム開発演習",
    "ポートフォリオ制作",
  ],
};

/** How many 授業 per week a subject has: 2 in years 1-2, 3 or 2 in year 3, 3 in year 4. */
function sessionsPerWeek(grade: number, index: number): number {
  if (grade <= 2) return 2;
  if (grade === 3) return index < 4 ? 3 : 2;
  return 3;
}

function subjectsOf(cls: ClassDef): { name: string; sessions: number }[] {
  return SUBJECTS[`${cls.program}${cls.grade}`].map((name, index) => ({
    name,
    sessions: sessionsPerWeek(cls.grade, index),
  }));
}

// ---- teachers and rooms ----

// Surnames only (the tool uses the 表記 as is). Invented combinations, no real person.
export const TEACHERS = [
  "青野",
  "細田",
  "石原",
  "上田",
  "江口",
  "太田",
  "片山",
  "木村",
  "小松",
  "斉藤",
  "島田",
  "杉本",
  "高橋",
  "田村",
  "中島",
  "橋本",
  "藤井",
  "松岡",
  "村上",
  "山口",
];

export type RoomDef = {
  name: string;
  building: string;
  kind: "ホームルーム" | "空き教室";
  note: string;
};

const HOME_ROOM_BUILDINGS: Record<string, string> = {
  A: "A棟1階",
  B: "B棟2階",
  C: "C棟3階",
};

const FREE_ROOMS: RoomDef[] = [
  { name: "E101", building: "E棟1階", kind: "空き教室", note: "PC教室" },
  { name: "E102", building: "E棟1階", kind: "空き教室", note: "PC教室" },
  { name: "E103", building: "E棟1階", kind: "空き教室", note: "PC教室" },
  { name: "E104", building: "E棟1階", kind: "空き教室", note: "PC教室" },
  { name: "D101", building: "D棟1階", kind: "空き教室", note: "ゼミ室" },
  { name: "D102", building: "D棟1階", kind: "空き教室", note: "ゼミ室" },
];

export const ROOMS: RoomDef[] = [
  ...CLASSES.map((cls) => ({
    name: cls.homeRoom,
    building: HOME_ROOM_BUILDINGS[cls.homeRoom[0]],
    kind: "ホームルーム" as const,
    note: "",
  })),
  ...FREE_ROOMS,
];

const PC_ROOMS = ["E101", "E102", "E103", "E104"];
const SEMINAR_ROOMS: Record<string, string> = {
  大学基礎ゼミ: "D101",
  実習報告ゼミ: "D102",
};
const SUBSTITUTE_ROOMS = ["D101", "D102"];

const PC_SUBJECTS = new Set([
  "プログラミング基礎",
  "プログラミング応用",
  "システム設計演習",
  "電子カルテ演習",
  "医療情報演習A",
  "医療情報演習B",
  "2Dグラフィックス",
  "3Dグラフィックス",
  "ゲームプログラミング基礎",
  "ゲームプログラミング応用",
  "ゲームエンジン演習",
  "チーム制作",
  "Webアプリ入門",
  "データベース演習",
  "サーバー構築",
  "チーム開発演習",
]);
const TEAM_TAUGHT = new Set(["チーム制作", "チーム開発演習"]); // two teachers
const NO_TEACHER = new Set(["キャリアデザイン"]); // 各担当 (the homeroom teacher)

export type Link = {
  className: string;
  subject: string;
  teachers: string[]; // empty = 各担当
  room: string; // TBD_ROOM = 教室未定
  sessions: number;
};

/** Hands out teachers and rooms so that nobody is overloaded (kept simple and deterministic). */
function buildLinks(): Link[] {
  const subjectLoad = new Map<string, number>();
  for (const cls of CLASSES) {
    for (const item of subjectsOf(cls)) {
      subjectLoad.set(
        item.name,
        (subjectLoad.get(item.name) ?? 0) + item.sessions,
      );
    }
  }

  const teacherLoad = TEACHERS.map(() => 0);
  const teachersOf = new Map<string, string[]>();
  const ordered = [...subjectLoad.entries()]
    .filter(([name]) => !NO_TEACHER.has(name))
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  for (const [name, load] of ordered) {
    const count = TEAM_TAUGHT.has(name) ? 2 : 1;
    const picked: number[] = [];
    while (picked.length < count) {
      let best = -1;
      teacherLoad.forEach((value, index) => {
        if (picked.includes(index)) return;
        if (best === -1 || value < teacherLoad[best]) best = index;
      });
      picked.push(best);
      teacherLoad[best] += load;
    }
    teachersOf.set(
      name,
      picked.map((index) => TEACHERS[index]),
    );
  }

  const pcLoad = PC_ROOMS.map(() => 0);
  const links: Link[] = [];
  for (const cls of CLASSES) {
    for (const item of subjectsOf(cls)) {
      let room = cls.homeRoom;
      if (NO_TEACHER.has(item.name)) room = TBD_ROOM;
      else if (SEMINAR_ROOMS[item.name]) room = SEMINAR_ROOMS[item.name];
      else if (PC_SUBJECTS.has(item.name)) {
        let best = 0;
        pcLoad.forEach((value, index) => {
          if (value < pcLoad[best]) best = index;
        });
        pcLoad[best] += item.sessions;
        room = PC_ROOMS[best];
      }
      links.push({
        className: cls.name,
        subject: item.name,
        teachers: teachersOf.get(item.name) ?? [],
        room,
        sessions: item.sessions,
      });
    }
  }
  return links;
}

export const LINKS: Link[] = buildLinks();

export const SUBJECT_NAMES: string[] = [
  ...new Set(LINKS.map((link) => link.subject)),
];

// ---- 休み・行事 ----

export type DemoEvent = {
  start: string;
  end: string | null; // null = one day
  name: string;
  className: string | null; // null = 全校
  cancelsClasses: boolean; // false: the day is a 行事 but lessons still happen
};

// 国民の祝日 for 年度 2026 (4/1〜翌4/11). Checked against the 内閣府 calendar rules with jpholiday.
const NATIONAL_HOLIDAYS: [string, string][] = [
  ["2026-04-29", "昭和の日"],
  ["2026-05-03", "憲法記念日"],
  ["2026-05-04", "みどりの日"],
  ["2026-05-05", "こどもの日"],
  ["2026-05-06", "振替休日"],
  ["2026-07-20", "海の日"],
  ["2026-08-11", "山の日"],
  ["2026-09-21", "敬老の日"],
  ["2026-09-22", "国民の休日"],
  ["2026-09-23", "秋分の日"],
  ["2026-10-12", "スポーツの日"],
  ["2026-11-03", "文化の日"],
  ["2026-11-23", "勤労感謝の日"],
  ["2027-01-01", "元日"],
  ["2027-01-11", "成人の日"],
  ["2027-02-11", "建国記念の日"],
  ["2027-02-23", "天皇誕生日"],
  ["2027-03-21", "春分の日"],
  ["2027-03-22", "振替休日"],
];

const SCHOOL_EVENTS: DemoEvent[] = [
  {
    start: "2026-07-21",
    end: "2026-08-31",
    name: "夏休み",
    className: null,
    cancelsClasses: true,
  },
  {
    start: "2026-11-12",
    end: "2026-11-13",
    name: "学園祭",
    className: null,
    cancelsClasses: true,
  },
  {
    // A 行事 where lessons still happen: the CSV then has both kinds of rows.
    start: "2026-12-09",
    end: null,
    name: "防災訓練",
    className: null,
    cancelsClasses: false,
  },
  {
    start: "2026-12-28",
    end: "2027-01-04",
    name: "冬休み",
    className: null,
    cancelsClasses: true,
  },
  {
    start: "2027-03-12",
    end: null,
    name: "卒業式",
    className: null,
    cancelsClasses: true,
  },
  {
    start: "2027-03-25",
    end: "2027-04-05",
    name: "春休み",
    className: null,
    cancelsClasses: true,
  },
  ...CLASSES.filter((cls) => cls.grade === 1).map((cls) => ({
    start: "2026-11-20",
    end: null,
    name: "校外学習",
    className: cls.name,
    cancelsClasses: true,
  })),
];

export const EVENTS: DemoEvent[] = [
  ...NATIONAL_HOLIDAYS.map(([date, name]) => ({
    start: date,
    end: null,
    name,
    className: null,
    cancelsClasses: true,
  })),
  ...SCHOOL_EVENTS,
].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

function eventsOn(date: string, className: string): DemoEvent[] {
  return EVENTS.filter(
    (event) =>
      (event.className === null || event.className === className) &&
      date >= event.start &&
      date <= (event.end ?? event.start),
  );
}

// ---- weekly pattern ----

function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type Slot = { day: number; period: number; link: Link };

const MAX_PER_DAY = 4;

/** One try at a weekly pattern. Returns null when it paints itself into a corner. */
function tryPattern(seed: number): Map<string, Slot[]> | null {
  const random = makeRandom(seed);
  const teacherBusy = new Set<string>();
  const roomBusy = new Set<string>();
  const result = new Map<string, Slot[]>();
  const order = [...CLASSES].sort(
    (a, b) =>
      LINKS.filter((l) => l.className === b.name).reduce(
        (sum, l) => sum + l.sessions,
        0,
      ) -
      LINKS.filter((l) => l.className === a.name).reduce(
        (sum, l) => sum + l.sessions,
        0,
      ),
  );

  for (const cls of order) {
    const classLinks = LINKS.filter((link) => link.className === cls.name);
    const items = shuffle(
      classLinks.flatMap((link) => Array.from({ length: link.sessions }, () => link)),
      random,
    );
    const slots: Slot[] = [];
    const dayCount = [0, 0, 0, 0, 0];
    const taken = new Set<string>();

    for (const link of items) {
      let placed = false;
      for (const strict of [true, false]) {
        if (placed) break;
        const days = shuffle([0, 1, 2, 3, 4], random).sort(
          (a, b) => dayCount[a] - dayCount[b],
        );
        for (const day of days) {
          if (placed) break;
          if (dayCount[day] >= MAX_PER_DAY) continue;
          if (strict && slots.some((s) => s.day === day && s.link === link)) {
            continue;
          }
          for (const period of shuffle([0, 1, 2, 3], random)) {
            if (taken.has(`${day}|${period}`)) continue;
            if (
              link.teachers.some((t) => teacherBusy.has(`${t}|${day}|${period}`))
            ) {
              continue;
            }
            const sharedRoom = link.room !== cls.homeRoom && link.room !== TBD_ROOM;
            if (sharedRoom && roomBusy.has(`${link.room}|${day}|${period}`)) {
              continue;
            }
            taken.add(`${day}|${period}`);
            link.teachers.forEach((t) => teacherBusy.add(`${t}|${day}|${period}`));
            if (sharedRoom) roomBusy.add(`${link.room}|${day}|${period}`);
            dayCount[day]++;
            slots.push({ day, period, link });
            placed = true;
            break;
          }
        }
      }
      if (!placed) return null;
    }
    result.set(cls.name, slots);
  }
  return result;
}

function buildPattern(): Map<string, Slot[]> {
  for (let seed = 1; seed <= 500; seed++) {
    const pattern = tryPattern(seed);
    if (pattern) return pattern;
  }
  throw new Error("could not build a weekly pattern without clashes");
}

// ---- lessons ----

export type Lesson = {
  className: string;
  date: string;
  period: number;
  subject: string;
  teachers: string[];
  room: string; // TBD_ROOM = 教室未定
};

const RANGE_START = "2026-11-01";
const RANGE_END = "2027-03-31";

function buildLessons(): Lesson[] {
  const pattern = buildPattern();
  const lessons: Lesson[] = [];
  for (const cls of CLASSES) {
    const slots = pattern.get(cls.name) ?? [];
    for (const date of datesBetween(RANGE_START, RANGE_END)) {
      const weekday = weekdayOf(date);
      if (weekday === 0 || weekday === 6) continue;
      if (eventsOn(date, cls.name).some((event) => event.cancelsClasses)) continue;
      for (const slot of slots.filter((s) => s.day === weekday - 1)) {
        lessons.push({
          className: cls.name,
          date,
          period: slot.period,
          subject: slot.link.subject,
          teachers: slot.link.teachers,
          room: slot.link.room,
        });
      }
    }
  }

  applyExceptions(lessons);
  return lessons.sort(
    (a, b) =>
      (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) ||
      a.period - b.period ||
      (a.className < b.className ? -1 : a.className > b.className ? 1 : 0),
  );
}

/**
 * One small difference per class and month, so that the cases the tool and the
 * import must accept (but flag) are in the data: a substitute teacher or a
 * free classroom that is not in the 紐づけ (blue cells), and a 教室未定.
 */
function applyExceptions(lessons: Lesson[]): void {
  const teacherBusy = new Set<string>();
  const roomBusy = new Set<string>();
  const mark = (lesson: Lesson) => {
    lesson.teachers.forEach((t) => teacherBusy.add(`${t}|${lesson.date}|${lesson.period}`));
    if (lesson.room !== TBD_ROOM) {
      roomBusy.add(`${lesson.room}|${lesson.date}|${lesson.period}`);
    }
  };
  lessons.forEach(mark);

  const random = makeRandom(20261105);
  const kinds = ["teacher", "room", "tbd"] as const;
  CLASSES.forEach((cls, classIndex) => {
    MONTHS.forEach((month, monthIndex) => {
      const kind = kinds[(classIndex + monthIndex) % kinds.length];
      const homeRoom = cls.homeRoom;
      const candidates = shuffle(
        lessons.filter(
          (lesson) =>
            lesson.className === cls.name &&
            lesson.date.startsWith(isoMonth(month)) &&
            Number(lesson.date.slice(8, 10)) <= 28 &&
            (kind === "teacher"
              ? lesson.teachers.length === 1
              : lesson.room === homeRoom),
        ),
        random,
      );
      for (const lesson of candidates) {
        if (kind === "tbd") {
          roomBusy.delete(`${lesson.room}|${lesson.date}|${lesson.period}`);
          lesson.room = TBD_ROOM;
          return;
        }
        if (kind === "room") {
          const free = SUBSTITUTE_ROOMS.find(
            (room) => !roomBusy.has(`${room}|${lesson.date}|${lesson.period}`),
          );
          if (free === undefined) continue;
          roomBusy.delete(`${lesson.room}|${lesson.date}|${lesson.period}`);
          lesson.room = free;
          roomBusy.add(`${free}|${lesson.date}|${lesson.period}`);
          return;
        }
        const substitute = shuffle(TEACHERS, random).find(
          (t) => !teacherBusy.has(`${t}|${lesson.date}|${lesson.period}`),
        );
        if (substitute === undefined) continue;
        teacherBusy.delete(`${lesson.teachers[0]}|${lesson.date}|${lesson.period}`);
        lesson.teachers = [substitute];
        teacherBusy.add(`${substitute}|${lesson.date}|${lesson.period}`);
        return;
      }
    });
  });
}

export const LESSONS: Lesson[] = buildLessons();

// ---- files ----

function homeRoomOf(className: string): string {
  return CLASSES.find((cls) => cls.name === className)?.homeRoom ?? "";
}

export function timetableFileName(className: string, yearMonth: string): string {
  return `${className}_${yearMonth}_取込用.csv`;
}

const TIMETABLE_HEADER = [
  "クラス",
  "日付",
  "曜日",
  "時限",
  "開始",
  "終了",
  "科目",
  "講師",
  "教室",
  "区分",
  "当月の最終入力日",
  "翌月の最終入力日",
  "対象年月",
  "ホームルーム教室",
];

/** 取込用CSV of one class and month: that month plus 翌月1〜11日 (not for March: R3-4). */
function timetableCsv(className: string, yearMonth: string): string {
  const monthEnd = monthEndOf(yearMonth);
  const next = nextYearMonth(yearMonth);
  const lastNext = yearMonth === "202703" ? "" : `${isoMonth(next)}-11`;
  const lastDate = lastNext === "" ? monthEnd : lastNext;
  const homeRoom = homeRoomOf(className);
  const tail = [monthEnd, lastNext, yearMonth, homeRoom];

  const rows: string[][] = [];
  for (const date of datesBetween(`${isoMonth(yearMonth)}-01`, lastDate)) {
    const weekday = WEEKDAY_NAMES[weekdayOf(date)];
    for (const event of eventsOn(date, className)) {
      rows.push([className, date, weekday, "", "", "", event.name, "", "", "休み・行事", ...tail]);
    }
    for (const lesson of LESSONS.filter(
      (l) => l.className === className && l.date === date,
    )) {
      const period = PERIODS[lesson.period];
      const tbd = lesson.room === TBD_ROOM;
      rows.push([
        className,
        date,
        weekday,
        period.name,
        period.start,
        period.end,
        lesson.subject,
        lesson.teachers.join("、"),
        lesson.room,
        tbd ? "教室未定" : "固定",
        ...tail,
      ]);
    }
  }
  return writeCsv(TIMETABLE_HEADER, rows);
}

const README = `# 架空のマスタと時間割(デモ用)

実在の人・学校とは関係のない、作り物のデータです。時間割作成ツールと、ミエルームの取り込みを試すために使います。
\`npm run demo-data\` で作り直せます(いつも同じ結果になります)。直接ファイルを書き換えず、\`scripts/demo-data/\` を直してください。

## 中身

- \`master/\` システムから出す8つのCSV(外部設計書 08章 8-3)。時間割作成ツールの \`ImportMasters\` で、まとめて選んで取り込みます。
- \`timetable/YYYYMM/\` 時間割作成ツールが出す取込用CSV(08章 8-2)。12クラス × 2026年11月〜2027年3月。

## クラス

大学併修・医療情報は1〜4年、ゲームITエキスパート・システム専攻は1〜2年(計12クラス)。
各クラスの教科数は、1年8・2年7・3年5・4年2です。

## 使うときの注意

- 取り込める月には期限があります(外部設計書 R3-3、R3-5): 当月は25日まで、過去の月は不可、新しい年度の月(2027年4月以降)は不可。
- 3月のファイルには、4月の行を入れていません(R3-4)。
- どのクラスも、平日は授業か休み・行事の名称が入っています(ME412 にならない)。
- 青(例外)になるデータを、クラス・月ごとに1つ入れています: 紐づけにない代理の講師、紐づけにない空き教室、教室未定。
- 2026-12-09 の防災訓練は、授業もある行事の日です(授業と休み・行事の両方の行が出ます)。
- 2026-11-20 の校外学習は、1年のクラスだけの行事です(CSV-08 の対象クラスに入っています)。
`;

export function buildFiles(): Map<string, string> {
  const files = new Map<string, string>();
  files.set("README.md", README);

  files.set(
    "master/クラスマスタ.csv",
    writeCsv(
      ["クラス名", "ホームルーム教室"],
      CLASSES.map((cls) => [cls.name, cls.homeRoom]),
    ),
  );
  files.set(
    "master/講師マスタ.csv",
    writeCsv(
      ["時間割での表記"],
      TEACHERS.map((name) => [name]),
    ),
  );
  files.set(
    "master/教科マスタ.csv",
    writeCsv(
      ["教科名"],
      SUBJECT_NAMES.map((name) => [name]),
    ),
  );
  files.set(
    "master/教室マスタ.csv",
    writeCsv(
      ["教室名", "棟・階", "分類", "備考"],
      ROOMS.map((room) => [room.name, room.building, room.kind, room.note]),
    ),
  );
  files.set(
    "master/紐づけ_クラスの教科.csv",
    writeCsv(
      ["クラス", "教科"],
      LINKS.map((link) => [link.className, link.subject]),
    ),
  );
  files.set(
    "master/紐づけ_教科の講師.csv",
    writeCsv(
      ["クラス", "教科", "講師"],
      LINKS.flatMap((link) =>
        (link.teachers.length === 0 ? [EACH_TEACHER] : link.teachers).map(
          (teacher) => [link.className, link.subject, teacher],
        ),
      ),
    ),
  );
  files.set(
    "master/紐づけ_教科の教室.csv",
    writeCsv(
      ["クラス", "教科", "教室"],
      LINKS.map((link) => [link.className, link.subject, link.room]),
    ),
  );
  files.set(
    "master/休み・行事.csv",
    writeCsv(
      ["開始日", "終了日", "名称", "対象クラス"],
      EVENTS.map((event) => [
        event.start,
        event.end ?? "",
        event.name,
        event.className ?? "",
      ]),
    ),
  );

  for (const month of MONTHS) {
    for (const cls of CLASSES) {
      files.set(
        `timetable/${month}/${timetableFileName(cls.name, month)}`,
        timetableCsv(cls.name, month),
      );
    }
  }
  return files;
}
