import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildMasterData } from "@/lib/domain/master-csv";
import { addDays, weekdayOf } from "@/lib/domain/school-date";
import {
  checkTimetableImport,
  MAX_FILE_BYTES,
  planWrite,
  unlockKey,
  type ImportContext,
  type ImportItem,
} from "@/lib/domain/timetable-import";
import type { ImportMasters } from "@/lib/domain/timetable-csv";
import { demoTexts } from "./support/master-source";

const HEAD =
  "クラス,日付,曜日,時限,開始,終了,科目,講師,教室,区分,当月の最終入力日,翌月の最終入力日,対象年月,ホームルーム教室";
const enc = (text: string) => new TextEncoder().encode(text);

const MASTERS: ImportMasters = {
  classes: [
    {
      name: "A1年",
      homeRoom: "A101",
      startYear: 2026,
      endYear: null,
      active: true,
    },
  ],
  subjects: [
    { name: "英語", active: true },
    { name: "旧教科", active: false },
  ],
  teachers: [
    { name: "岸本", active: true },
    { name: "石原", active: true },
    { name: "退職者", active: false },
  ],
  rooms: [
    { name: "A101", active: true },
    { name: "E101", active: true },
    { name: "旧教室", active: false },
  ],
};

const CONTEXT: ImportContext = {
  today: "2026-11-06",
  masters: MASTERS,
  unlocked: new Set(),
};

/** One row of the file; every column can be replaced by its heading. */
function row(
  date: string,
  over: Record<string, string> = {},
  month = "2026-11",
) {
  const end = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0))
    .toISOString()
    .slice(0, 10);
  const cells: Record<string, string> = {
    クラス: "A1年",
    日付: date,
    曜日: "月",
    時限: "1限",
    開始: "9:15",
    終了: "10:45",
    科目: "英語",
    講師: "岸本",
    教室: "A101",
    区分: "固定",
    当月の最終入力日: end,
    翌月の最終入力日: "",
    対象年月: month.replace("-", ""),
    ホームルーム教室: "A101",
    ...over,
  };
  return HEAD.split(",").map((h) => cells[h]);
}

function weekdays(month: string): string[] {
  const days: string[] = [];
  for (let d = `${month}-01`; d.startsWith(month); d = addDays(d, 1)) {
    if (weekdayOf(d) >= 1 && weekdayOf(d) <= 5) days.push(d);
  }
  return days;
}

const csv = (rows: string[][], head = HEAD) =>
  [head, ...rows.map((r) => r.join(","))].join("\r\n") + "\r\n";

/** A file that passes: a lesson on every weekday of the month. */
function goodRows(month = "2026-11", over: Record<string, string> = {}) {
  return weekdays(month).map((d) => row(d, over, month));
}

function check(
  files: Record<string, string | Uint8Array>,
  context: Partial<ImportContext> = {},
) {
  return checkTimetableImport(
    Object.entries(files).map(([name, content]) => ({
      name,
      bytes: typeof content === "string" ? enc(content) : content,
    })),
    { ...CONTEXT, ...context },
  );
}

function codes(result: ReturnType<typeof check>, level?: string) {
  return result.files
    .flatMap((f) => f.issues)
    .filter((i) => level === undefined || i.level === level)
    .map((i) => i.code);
}

const one = (text: string, context: Partial<ImportContext> = {}) =>
  check({ "a.csv": text }, context);

describe("デモの取込用CSV(60ファイル)", () => {
  const { data } = buildMasterData(demoTexts());
  const masters: ImportMasters = {
    classes: data!.classes.map((c) => ({
      ...c,
      startYear: 2026,
      endYear: null,
      active: true,
    })),
    subjects: data!.subjects.map((s) => ({ name: s.name, active: true })),
    teachers: data!.teachers.map((t) => ({
      name: t.displayName,
      active: true,
    })),
    rooms: data!.rooms.map((r) => ({ name: r.name, active: true })),
  };
  const root = join(process.cwd(), "demo-data", "timetable");
  const files = readdirSync(root).flatMap((month) =>
    readdirSync(join(root, month)).map((name) => ({
      name,
      bytes: new Uint8Array(readFileSync(join(root, month, name))),
    })),
  );

  it("60ファイルが、エラーなしで通る", () => {
    expect(files).toHaveLength(60);
    // 50 files at a time (S20). Two rounds.
    for (const part of [files.slice(0, 30), files.slice(30)]) {
      const result = checkTimetableImport(part, { ...CONTEXT, masters });
      const problems = result.files.flatMap((f) =>
        f.issues
          .filter((i) => i.level === "error")
          .map((i) => `${f.name}: ${i.message}`),
      );
      expect(problems).toEqual([]);
      expect(result.ok).toBe(true);
      expect(result.items).toHaveLength(part.length);
    }
  });

  it("授業と休み・行事の数が、ファイルの行と合う", () => {
    const sample = files.find(
      (f) => f.name === "大学併修1年_202611_取込用.csv",
    )!;
    const result = checkTimetableImport([sample], { ...CONTEXT, masters });
    const text = new TextDecoder().decode(sample.bytes);
    const kinds = text
      .split("\r\n")
      .slice(1)
      .map((l) => l.split(",")[9]);
    expect(result.files[0].lessonCount).toBe(
      kinds.filter((k) => k === "固定" || k === "教室未定").length,
    );
    expect(result.files[0].closureCount).toBe(
      kinds.filter((k) => k === "休み・行事").length,
    );
    expect(result.items[0].className).toBe("大学併修1年");
    expect(result.items[0].month).toBe("2026-11");
  });
});

describe("正しいファイル", () => {
  it("BOM があってもなくても読める。授業の中身を取り出す", () => {
    const text = csv([
      row("2026-11-02", { 講師: "岸本、石原" }),
      row("2026-11-03", {
        時限: "2限",
        開始: "11:00",
        終了: "12:30",
        講師: "",
        教室: "ー",
        区分: "教室未定",
      }),
      row("2026-11-04", {
        区分: "休み・行事",
        科目: "学園祭",
        開始: "",
        終了: "",
        講師: "",
        教室: "",
      }),
      ...weekdays("2026-11")
        .filter((d) => d > "2026-11-04")
        .map((d) => row(d)),
    ]);
    for (const content of [text, `﻿${text}`]) {
      const result = one(content);
      expect(codes(result)).toEqual([]);
      expect(result.ok).toBe(true);
      const [item] = result.items;
      expect(item.lessons[0]).toMatchObject({
        date: "2026-11-02",
        periodNo: 1,
        startMinutes: 555,
        endMinutes: 645,
        subject: "英語",
        teachers: ["岸本", "石原"],
        room: "A101",
      });
      expect(item.lessons[1]).toMatchObject({
        teachers: [],
        room: null,
        periodNo: 2,
      });
      expect(item.closures).toEqual([{ date: "2026-11-04", name: "学園祭" }]);
      expect(item.lastInputDate).toBe("2026-11-30");
    }
  });

  it("列の順序は問わず、余分な列は無視する", () => {
    const head = [...HEAD.split(",").reverse(), "メモ"].join(",");
    const rows = goodRows().map((r) => [...r.slice().reverse(), "メモの内容"]);
    const result = one(csv(rows, head));
    expect(codes(result, "error")).toEqual([]);
    expect(result.items[0].lessons).toHaveLength(rows.length);
  });

  it("前後の空白(全角も)と、全角数字の教室名を整える", () => {
    const padded = goodRows().map((r) => r.map((cell) => `　${cell}　`));
    expect(codes(one(csv(padded)), "error")).toEqual([]);
    const full = one(
      csv(
        goodRows("2026-11", { 教室: "E１０１", ホームルーム教室: "A１０１" }),
      ),
    );
    expect(codes(full, "error")).toEqual([]);
    expect(full.items[0].lessons[0].room).toBe("E101");
  });

  it("授業が1つもない月は、「授業なし」の1行で入れられる(平日の確認はしない)", () => {
    const result = one(
      csv([
        row("2026-11-01", {
          区分: "授業なし",
          時限: "",
          開始: "",
          終了: "",
          科目: "",
          講師: "",
          教室: "",
        }),
      ]),
    );
    expect(codes(result, "error")).toEqual([]);
    expect(result.items[0].lessons).toEqual([]);
  });

  it("翌月1〜11日の仮の時間割を読む。翌月の最終入力日まで平日を確かめる", () => {
    const next = ["2026-12-01", "2026-12-02", "2026-12-03"].map((d) =>
      row(d, { 翌月の最終入力日: "2026-12-03" }),
    );
    const rows = [
      ...goodRows("2026-11", { 翌月の最終入力日: "2026-12-03" }),
      ...next,
    ];
    const ok = one(csv(rows));
    expect(codes(ok, "error")).toEqual([]);
    expect(ok.items[0].nextLastInputDate).toBe("2026-12-03");
    expect(
      ok.items[0].lessons.filter((l) => l.date.startsWith("2026-12")),
    ).toHaveLength(3);
    // 12/3 is the last input day but 12/2 has nothing: ME412
    const gap = one(
      csv([
        ...goodRows("2026-11", { 翌月の最終入力日: "2026-12-03" }),
        row("2026-12-01", { 翌月の最終入力日: "2026-12-03" }),
        row("2026-12-03", { 翌月の最終入力日: "2026-12-03" }),
      ]),
    );
    expect(codes(gap, "error")).toEqual(["ME412"]);
    expect(gap.files[0].issues[0].message).toContain("12/2");
  });
});

describe("ファイルの読み取り (ME401〜ME403, ME414〜ME419)", () => {
  it("ME401: UTF-8 で読めない", () => {
    expect(
      codes(
        check({ "a.csv": new Uint8Array([0x83, 0x4e, 0xff, 0xfe]) }),
        "error",
      ),
    ).toEqual(["ME401"]);
  });

  it("ME402: 必要な列がない", () => {
    const result = one(
      csv(
        goodRows().map((r) => r.slice(0, 13)),
        HEAD.split(",").slice(0, 13).join(","),
      ),
    );
    expect(codes(result, "error")).toEqual(["ME402"]);
    expect(result.files[0].issues[0].message).toContain("ホームルーム教室");
  });

  it("ME403: 1つのファイルに複数のクラス・月・最終入力日", () => {
    const variants: Record<string, string>[] = [
      { クラス: "B1年" },
      { 対象年月: "202612" },
      { 当月の最終入力日: "2026-11-29" },
    ];
    for (const over of variants) {
      const rows = goodRows();
      rows[3] = row(rows[3][1], over);
      expect(codes(one(csv(rows)), "error"), JSON.stringify(over)).toContain(
        "ME403",
      );
    }
  });

  it("ME414: 日付・区分・時刻・月・最終入力日の形", () => {
    const bad = (over: Record<string, string>) => {
      const rows = goodRows();
      rows[0] = row(rows[0][1], over);
      return codes(one(csv(rows)), "error");
    };
    expect(bad({ 日付: "2026/11/02" })).toContain("ME414");
    expect(bad({ 日付: "2026-11-31" })).toContain("ME414");
    expect(bad({ 区分: "仮押さえ" })).toContain("ME414");
    expect(bad({ 開始: "9時15分" })).toContain("ME414");
    expect(bad({ 終了: "25:00" })).toContain("ME414");
    expect(bad({ 科目: "" })).toContain("ME414");
    expect(bad({ 教室: "ー" })).toContain("ME414"); // 固定 needs a room name
    expect(bad({ 区分: "教室未定" })).toContain("ME414"); // 教室未定 needs ー
    expect(
      bad({
        区分: "休み・行事",
        科目: "あ".repeat(21),
        開始: "",
        終了: "",
        講師: "",
        教室: "",
      }),
    ).toContain("ME414");
    const month = goodRows();
    expect(
      codes(
        one(
          csv(
            month.map((r) => {
              r[12] = "2026-11";
              return r;
            }),
          ),
        ),
        "error",
      ),
    ).toContain("ME414");
    expect(
      codes(
        one(
          csv(
            month.map((r) => {
              r[10] = "11/30";
              return r;
            }),
          ),
        ),
        "error",
      ),
    ).toContain("ME414");
    expect(
      codes(
        one(csv(goodRows("2026-11", { 翌月の最終入力日: "2026-12-20" }))),
        "error",
      ),
    ).toContain("ME414");
  });

  it("ME415: 同じ日・同じ開始時刻の授業が2つ", () => {
    const rows = goodRows();
    rows.push(row(rows[0][1], { 科目: "英語", 講師: "石原", 教室: "E101" }));
    expect(codes(one(csv(rows)), "error")).toContain("ME415");
  });

  it("ME416: 開始が終了と同じか後", () => {
    const rows = goodRows();
    rows[0] = row(rows[0][1], { 開始: "10:45", 終了: "9:15" });
    expect(codes(one(csv(rows)), "error")).toContain("ME416");
  });

  it("ME417: 対象月と翌月11日までの外", () => {
    for (const date of ["2026-10-30", "2026-12-12"]) {
      const rows = goodRows();
      rows.push(row(date));
      expect(codes(one(csv(rows)), "error"), date).toContain("ME417");
    }
  });

  it("ME418: 1,000行を超える。1ファイル1MBを超える。51ファイル。合計4MB", () => {
    const many = Array.from({ length: 1001 }, () => row("2026-11-02"));
    expect(codes(one(csv(many)), "error")).toEqual(["ME418"]);
    const big = check({ "big.csv": new Uint8Array(MAX_FILE_BYTES + 1) });
    expect(codes(big, "error")).toEqual(["ME418"]);
    const files: Record<string, string> = {};
    for (let i = 0; i < 51; i++) files[`f${i}.csv`] = csv(goodRows());
    expect(check(files).general.map((i) => i.code)).toEqual(["ME418"]);
    expect(check(files).ok).toBe(false);
    const half = new Uint8Array(MAX_FILE_BYTES - 1);
    expect(
      check({ a: half, b: half, c: half, d: half, e: half }).general.map(
        (i) => i.code,
      ),
    ).toEqual(["ME418"]);
  });

  it("メッセージが多いファイルは、30件までにして、残りは件数で示す(エラーは先)", () => {
    const rows = goodRows();
    for (let i = 0; i < 100; i++)
      rows.push(row("2026/11/02", { 日付: `2026/11/${i}` }));
    const result = one(csv(rows));
    const issues = result.files[0].issues;
    expect(result.files[0].verdict).toBe("error");
    expect(issues).toHaveLength(31);
    expect(issues[30]).toMatchObject({ level: "info", message: "…ほか70件" });
    expect(issues.slice(0, 30).every((i) => i.level === "error")).toBe(true);
  });

  it("ME419: 時限と合わない時刻", () => {
    const rows = goodRows();
    rows[0] = row(rows[0][1], { 開始: "9:30", 終了: "10:45" });
    expect(codes(one(csv(rows)), "error")).toContain("ME419");
    rows[0] = row(rows[0][1], { 開始: "9:15", 終了: "10:00" });
    expect(codes(one(csv(rows)), "error")).toContain("ME419");
  });
});

describe("マスタとの照合 (ME408〜ME413, MW401)", () => {
  it("ME409: クラス・教科・講師・教室がマスタにない(同じ名前は1回だけ)", () => {
    const rows = goodRows();
    rows[0] = row(rows[0][1], { 科目: "ない教科" });
    rows[1] = row(rows[1][1], { 講師: "いない先生" });
    rows[2] = row(rows[2][1], { 教室: "Z999" });
    rows[3] = row(rows[3][1], { 科目: "ない教科" });
    const result = one(csv(rows));
    expect(codes(result, "error")).toEqual(["ME409", "ME409", "ME409"]);
    const unknownClass = one(csv(goodRows("2026-11", { クラス: "Z9年" })));
    expect(codes(unknownClass, "error")).toContain("ME409");
  });

  it("MW401: 無効なマスタは警告だけ。取り込める", () => {
    const rows = goodRows();
    rows[0] = row(rows[0][1], {
      科目: "旧教科",
      講師: "退職者",
      教室: "旧教室",
    });
    const result = one(csv(rows));
    expect(codes(result, "warning")).toEqual(["MW401", "MW401", "MW401"]);
    expect(result.files[0].verdict).toBe("warning");
    expect(result.ok).toBe(true);
    const inactiveClass = one(csv(goodRows()), {
      masters: {
        ...MASTERS,
        classes: [{ ...MASTERS.classes[0], active: false }],
      },
    });
    expect(codes(inactiveClass, "warning")).toEqual(["MW401"]);
    expect(inactiveClass.ok).toBe(true);
  });

  it("ME410: ホームルーム教室がクラスマスタと違う", () => {
    expect(
      codes(
        one(csv(goodRows("2026-11", { ホームルーム教室: "E101" }))),
        "error",
      ),
    ).toEqual(["ME410"]);
  });

  it("ME411: 当月の最終入力日が月末ではない", () => {
    expect(
      codes(
        one(csv(goodRows("2026-11", { 当月の最終入力日: "2026-11-29" }))),
        "error",
      ),
    ).toEqual(["ME411"]);
  });

  it("ME412: 授業も名目もない平日。休み・行事の行があれば名目になる", () => {
    const rows = goodRows();
    const day = rows[5][1];
    const without = rows.filter((_, i) => i !== 5);
    const result = one(csv(without));
    expect(codes(result, "error")).toEqual(["ME412"]);
    expect(result.files[0].issues[0].message).toContain(
      `${+day.slice(5, 7)}/${+day.slice(8)}`,
    );
    const named = [
      ...without,
      row(day, {
        区分: "休み・行事",
        科目: "創立記念日",
        開始: "",
        終了: "",
        講師: "",
        教室: "",
      }),
    ];
    expect(codes(one(csv(named)), "error")).toEqual([]);
    // 10 days without anything: the list is cut
    const sparse = rows.slice(0, 5);
    expect(one(csv(sparse)).files[0].issues[0].message).toContain("ほか");
  });

  it("ME413: 外部講師", () => {
    const rows = goodRows();
    rows[0] = row(rows[0][1], { 講師: "外部講師" });
    expect(codes(one(csv(rows)), "error")).toEqual(["ME413"]);
  });
});

describe("月と、まとめて選んだファイル (ME404〜ME408)", () => {
  const nov = csv(goodRows());

  it("ME404: 同じクラス・同じ月が2つ", () => {
    const result = check({ "a.csv": nov, "b.csv": nov });
    expect(
      result.files.map((f) =>
        f.issues.filter((i) => i.level === "error").map((i) => i.code),
      ),
    ).toEqual([["ME404"], ["ME404"]]);
    expect(result.ok).toBe(false);
    expect(result.items).toEqual([]);
  });

  it("ME405: 過去の月", () => {
    expect(codes(one(nov, { today: "2026-12-10" }), "error")).toEqual([
      "ME405",
    ]);
  });

  it("ME406: 新しい年度の月(3月中は4月の分を取り込めない)", () => {
    const april = csv(goodRows("2027-04"));
    expect(codes(one(april, { today: "2027-03-15" }), "error")).toEqual([
      "ME406",
    ]);
    expect(codes(one(april, { today: "2027-04-01" }), "error")).toEqual([]);
    expect(codes(one(april, { today: "2027-03-31" }), "error")).toEqual([
      "ME406",
    ]);
  });

  it("ME407: 26日の0時から当月は締め。例外解除したクラス×月は通る。翌月は締めない", () => {
    expect(codes(one(nov, { today: "2026-11-25" }), "error")).toEqual([]);
    expect(codes(one(nov, { today: "2026-11-26" }), "error")).toEqual([
      "ME407",
    ]);
    const unlocked = new Set([unlockKey("A1年", "2026-11")]);
    expect(codes(one(nov, { today: "2026-11-30", unlocked }), "error")).toEqual(
      [],
    );
    expect(
      codes(one(csv(goodRows("2026-12")), { today: "2026-11-30" }), "error"),
    ).toEqual([]);
  });

  it("ME408: その月の年度にクラスが存在しない", () => {
    const ended: ImportMasters = {
      ...MASTERS,
      classes: [{ ...MASTERS.classes[0], endYear: 2025 }],
    };
    expect(codes(one(nov, { masters: ended }), "error")).toEqual(["ME408"]);
    const starts2027: ImportMasters = {
      ...MASTERS,
      classes: [{ ...MASTERS.classes[0], startYear: 2027 }],
    };
    expect(codes(one(nov, { masters: starts2027 }), "error")).toEqual([
      "ME408",
    ]);
  });

  it("エラーのファイルが1つでもあれば、取り込めない(items は空)", () => {
    const result = check({
      "ok.csv": nov,
      "ng.csv": csv(goodRows("2026-12", { 当月の最終入力日: "2026-12-30" })),
    });
    expect(result.ok).toBe(false);
    expect(result.items).toEqual([]);
    expect(result.files.map((f) => f.verdict)).toEqual(["ok", "error"]);
    expect(check({}).ok).toBe(false);
  });
});

describe("3月のファイル (R3-4)", () => {
  it("4月の行は読み飛ばす(確認もしない)。お知らせ(MI401)を出す", () => {
    const rows = [
      ...goodRows("2027-03", { 翌月の最終入力日: "2027-04-05" }),
      row(
        "2027-04-01",
        { 翌月の最終入力日: "2027-04-05", 科目: "ない教科" },
        "2027-03",
      ),
      row(
        "2027-04-02",
        { 翌月の最終入力日: "2027-04-05", 開始: "9時" },
        "2027-03",
      ),
    ];
    const result = one(csv(rows), { today: "2027-03-10" });
    expect(codes(result, "error")).toEqual([]);
    expect(codes(result, "info")).toEqual(["MI401"]);
    expect(
      result.items[0].lessons.every((l) => l.date.startsWith("2027-03")),
    ).toBe(true);
    expect(result.items[0].nextLastInputDate).toBeNull();
    expect(result.items[0].skippedRows).toBe(2);
  });
});

describe("planWrite: 書き込みの計画 (R3-2, R3-6, R3-10)", () => {
  const lesson = (date: string) => ({
    date,
    startMinutes: 555,
    endMinutes: 645,
    periodNo: 1 as const,
    subject: "英語",
    teachers: [],
    room: null,
  });
  const item: ImportItem = {
    className: "A1年",
    month: "2026-11",
    lastInputDate: "2026-11-30",
    nextLastInputDate: "2026-12-03",
    lessons: [lesson("2026-11-02"), lesson("2026-12-01")],
    closures: [
      { date: "2026-11-23", name: "勤労感謝の日" },
      { date: "2026-12-02", name: "校内行事" },
    ],
    skippedRows: 0,
  };

  it("その月と、(翌月のファイルがなければ)翌月1〜11日を入れ替える。翌月の仮の行も保存する", () => {
    const plan = planWrite(item, {
      nextMonthImported: false,
      schoolClosures: [],
    });
    expect(plan.replace).toEqual([
      { from: "2026-11-01", to: "2026-11-30" },
      { from: "2026-12-01", to: "2026-12-11" },
    ]);
    expect(plan.lessons.map((l) => l.date)).toEqual([
      "2026-11-02",
      "2026-12-01",
    ]);
    expect(plan.closures).toHaveLength(2);
    expect(plan.status).toEqual({
      month: "2026-11",
      lastInputDate: "2026-11-30",
      nextLastInputDate: "2026-12-03",
    });
  });

  it("翌月のファイルが取り込み済みなら、翌月には触らない(R3-6)", () => {
    const plan = planWrite(item, {
      nextMonthImported: true,
      schoolClosures: [],
    });
    expect(plan.replace).toEqual([{ from: "2026-11-01", to: "2026-11-30" }]);
    expect(plan.lessons.map((l) => l.date)).toEqual(["2026-11-02"]);
    expect(plan.closures.map((c) => c.date)).toEqual(["2026-11-23"]);
  });

  it("3月のファイルは、4月に触らない", () => {
    const march: ImportItem = {
      ...item,
      month: "2027-03",
      lastInputDate: "2027-03-31",
      nextLastInputDate: null,
      lessons: [lesson("2027-03-01")],
      closures: [],
    };
    const plan = planWrite(march, {
      nextMonthImported: false,
      schoolClosures: [],
    });
    expect(plan.replace).toEqual([{ from: "2027-03-01", to: "2027-03-31" }]);
  });

  it("全校の休み・行事と、同じ日付・同じ名称なら保存しない。名称が違えば、そのクラスの行事にする", () => {
    const plan = planWrite(item, {
      nextMonthImported: false,
      schoolClosures: [
        {
          startDate: "2026-11-22",
          endDate: "2026-11-24",
          name: "勤労感謝の日",
        },
        { startDate: "2026-12-02", endDate: null, name: "学園祭" },
      ],
    });
    expect(plan.closures).toEqual([{ date: "2026-12-02", name: "校内行事" }]);
  });
});
