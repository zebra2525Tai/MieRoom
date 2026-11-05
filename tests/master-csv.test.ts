import { describe, expect, it } from "vitest";
import { buildMasterData, type MasterFileTexts } from "@/lib/domain/master-csv";

// A small set that passes every rule. Each test changes one thing.
function validFiles(): MasterFileTexts {
  return {
    classes: "クラス名,ホームルーム教室\r\nA1年,A101\r\nB1年,A102\r\n",
    teachers: "時間割での表記\r\n岸本\r\n石原\r\n",
    subjects: "教科名\r\n英語\r\n数学\r\n",
    rooms:
      "教室名,棟・階,分類,備考\r\nA101,A棟1階,ホームルーム,\r\nA102,A棟1階,ホームルーム,\r\nE101,E棟1階,空き教室,PC教室\r\n",
    classSubjects: "クラス,教科\r\nA1年,英語\r\nA1年,数学\r\nB1年,英語\r\n",
    subjectTeachers:
      "クラス,教科,講師\r\nA1年,英語,岸本\r\nA1年,数学,各担当\r\nB1年,英語,石原\r\n",
    subjectRooms:
      "クラス,教科,教室\r\nA1年,英語,A101\r\nA1年,数学,ー\r\nB1年,英語,E101\r\n",
    closures:
      "開始日,終了日,名称,対象クラス\r\n2026-11-03,,文化の日,\r\n2026-11-20,,校外学習,A1年\r\n2026-12-28,2027-01-04,冬休み,\r\n",
  };
}

function errorsOf(files: MasterFileTexts) {
  return buildMasterData(files).issues.filter((i) => i.level === "error");
}

describe("buildMasterData: 正しいデータ", () => {
  it("エラーなしで、すべてを読み取る", () => {
    const { data, issues } = buildMasterData(validFiles());
    expect(issues).toEqual([]);
    expect(data).not.toBeNull();
    expect(data!.classes).toEqual([
      { name: "A1年", homeRoom: "A101" },
      { name: "B1年", homeRoom: "A102" },
    ]);
    expect(data!.teachers.map((t) => t.displayName)).toEqual(["岸本", "石原"]);
    expect(data!.rooms[2]).toEqual({
      name: "E101",
      building: "E棟1階",
      kind: "FREE",
      note: "PC教室",
    });
  });

  it("「各担当」は講師なし、「ー」は教室未定として読む", () => {
    const { data } = buildMasterData(validFiles());
    expect(data!.subjectTeachers).toContainEqual({
      className: "A1年",
      subjectName: "数学",
      teacherName: null,
    });
    expect(data!.subjectRooms).toContainEqual({
      className: "A1年",
      subjectName: "数学",
      roomName: null,
    });
  });

  it("休み・行事: 終了日と対象クラスが空なら、1日だけ・全校", () => {
    const { data } = buildMasterData(validFiles());
    expect(data!.closures[0]).toEqual({
      startDate: "2026-11-03",
      endDate: null,
      name: "文化の日",
      className: null,
    });
    expect(data!.closures[1].className).toBe("A1年");
    expect(data!.closures[2].endDate).toBe("2027-01-04");
  });

  it("BOM付き・LF改行・前後の空白(全角を含む)を受け付ける", () => {
    const files = validFiles();
    files.subjects = "﻿教科名\n 英語 \n　数学　\n";
    const { data, issues } = buildMasterData(files);
    expect(issues).toEqual([]);
    expect(data!.subjects.map((s) => s.name)).toEqual(["英語", "数学"]);
  });

  it("見出しは名前で読む(順序が違っても、余分な列があってもよい)", () => {
    const files = validFiles();
    files.classSubjects =
      "教科,メモ,クラス\r\n英語,x,A1年\r\n数学,x,A1年\r\n英語,x,B1年\r\n";
    expect(errorsOf(files)).toEqual([]);
  });

  it("教室名の全角数字は半角にそろえる", () => {
    const files = validFiles();
    files.rooms = files.rooms.replace("E101,", "Ｅ１０１,").replace("Ｅ", "E");
    files.subjectRooms = files.subjectRooms.replace("E101", "E１０１");
    const { data, issues } = buildMasterData(files);
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
    expect(data!.rooms.map((r) => r.name)).toContain("E101");
  });
});

describe("buildMasterData: 名前の規則 (R5-1)", () => {
  it("同じ種類で名前が重複するとエラー", () => {
    const files = validFiles();
    files.subjects += "英語\r\n";
    expect(errorsOf(files).map((e) => e.code)).toContain("ME502");
  });

  it("全角・半角の違うだけの教室名は重複とみなす", () => {
    const files = validFiles();
    files.rooms += "Ｅ１０１,E棟,空き教室,\r\n".replace("Ｅ", "E");
    expect(errorsOf(files).map((e) => e.code)).toContain("ME502");
  });

  it("講師の「各担当」「外部講師」「、」はエラー (ME503)", () => {
    for (const bad of ["各担当", "外部講師", "山田、佐藤"]) {
      const files = validFiles();
      files.teachers += `${bad}\r\n`;
      expect(errorsOf(files).map((e) => e.code)).toContain("ME503");
    }
  });

  it("教室名「ー」はエラー", () => {
    const files = validFiles();
    files.rooms += "ー,,空き教室,\r\n";
    expect(errorsOf(files).length).toBeGreaterThan(0);
  });

  it("文字数の上限を超えるとエラー(クラス30、講師20、教科30、教室20、備考50)", () => {
    const cases: [keyof MasterFileTexts, string][] = [
      ["classes", `${"あ".repeat(31)},A101\r\n`],
      ["teachers", `${"あ".repeat(21)}\r\n`],
      ["subjects", `${"あ".repeat(31)}\r\n`],
      ["rooms", `${"A".repeat(21)},,空き教室,\r\n`],
      ["rooms", `X1,,空き教室,${"あ".repeat(51)}\r\n`],
    ];
    for (const [key, row] of cases) {
      const files = validFiles();
      files[key] += row;
      expect(errorsOf(files).length).toBeGreaterThan(0);
    }
  });

  it("上限ちょうどはよい", () => {
    const files = validFiles();
    files.teachers += `${"あ".repeat(20)}\r\n`;
    expect(errorsOf(files)).toEqual([]);
  });

  it("教室の分類が「ホームルーム」「空き教室」以外だとエラー", () => {
    const files = validFiles();
    files.rooms += "Z1,,体育館,\r\n";
    expect(errorsOf(files).length).toBeGreaterThan(0);
  });
});

describe("buildMasterData: 書き出し前の確認 (R5-6)", () => {
  it("1: ホームルーム教室が教室マスタにない", () => {
    const files = validFiles();
    files.classes += "C1年,Z999\r\n";
    expect(
      errorsOf(files)
        .map((e) => e.message)
        .join(),
    ).toContain("R5-6 の1");
  });

  it("2: 別のクラスと、ホームルーム教室が重なる", () => {
    const files = validFiles();
    files.classes += "C1年,A101\r\n";
    expect(
      errorsOf(files)
        .map((e) => e.message)
        .join(),
    ).toContain("R5-6 の2");
  });

  it("3: クラスの教科に、講師の行がない", () => {
    const files = validFiles();
    files.classSubjects += "B1年,数学\r\n";
    expect(
      errorsOf(files)
        .map((e) => e.message)
        .join(),
    ).toContain("R5-6 の3");
  });

  it("4: 教科の講師・教室が、クラスの教科にない組み合わせを指す", () => {
    const files = validFiles();
    files.subjectTeachers += "B1年,数学,岸本\r\n";
    files.subjectRooms += "B1年,数学,A102\r\n";
    const text = errorsOf(files)
      .map((e) => e.message)
      .join();
    expect(text).toContain("R5-6 の4");
  });

  it("5: 講師・教室がマスタにない(ME409)", () => {
    const files = validFiles();
    files.subjectTeachers = files.subjectTeachers.replace("石原", "不明");
    files.subjectRooms = files.subjectRooms.replace("E101", "Z999");
    const codes = errorsOf(files).map((e) => e.code);
    expect(codes.filter((c) => c === "ME409").length).toBeGreaterThanOrEqual(2);
  });

  it("同じ組み合わせの紐づけは、エラー (ME506)", () => {
    const files = validFiles();
    files.classSubjects += "A1年,英語\r\n";
    files.subjectTeachers += "A1年,英語,岸本\r\n";
    files.subjectRooms += "A1年,英語,A101\r\n";
    const codes = errorsOf(files).map((e) => e.code);
    expect(codes.filter((c) => c === "ME506").length).toBe(3);
  });

  it("同じクラスの同じ教科に、講師が2人いるのは、よい", () => {
    const files = validFiles();
    files.subjectTeachers += "B1年,英語,岸本\r\n";
    expect(errorsOf(files)).toEqual([]);
  });

  it("行数の上限: 休み・行事は200行まで、180行を超えると警告", () => {
    const row = (day: number) =>
      `2026-05-${String((day % 28) + 1).padStart(2, "0")},,行事${day},\r\n`;
    const over180 = validFiles();
    over180.closures += Array.from({ length: 180 }, (_, i) => row(i)).join("");
    const warn = buildMasterData(over180).issues;
    expect(warn.some((i) => i.code === "MW503")).toBe(true);
    expect(warn.some((i) => i.level === "error")).toBe(false);

    const over200 = validFiles();
    over200.closures += Array.from({ length: 200 }, (_, i) => row(i)).join("");
    expect(errorsOf(over200).map((e) => e.code)).toContain("ME510");
  });
});

describe("buildMasterData: ファイルの形・休み・行事", () => {
  it("必須の列がないとエラー (ME402)", () => {
    const files = validFiles();
    files.rooms = "教室名,分類\r\nA101,ホームルーム\r\n";
    expect(errorsOf(files).map((e) => e.code)).toContain("ME402");
  });

  it("日付が正しくない・存在しない日・終了が開始より前はエラー", () => {
    for (const row of [
      "2026/11/03,,x,\r\n",
      "2026-02-30,,x,\r\n",
      "2026-11-05,2026-11-04,x,\r\n",
    ]) {
      const files = validFiles();
      files.closures += row;
      expect(errorsOf(files).length).toBeGreaterThan(0);
    }
  });

  it("対象クラスがマスタにないとエラー", () => {
    const files = validFiles();
    files.closures += "2026-11-21,,校外学習,存在しない年\r\n";
    expect(errorsOf(files).map((e) => e.code)).toContain("ME409");
  });

  it("エラーがあるときは、データを返さない(一部だけ入れない)", () => {
    const files = validFiles();
    files.subjects += "英語\r\n";
    expect(buildMasterData(files).data).toBeNull();
  });
});
