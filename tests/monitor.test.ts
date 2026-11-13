import { describe, expect, it } from "vitest";
import { FLOORS, PLAN_ROOM_NAMES, SCALE } from "@/lib/domain/floor-plan";
import {
  balanceLines,
  boundsOf,
  centroid,
  estimateWidth,
  extentAt,
  FONT,
  lessonLayout,
} from "@/lib/domain/floor-text";
import {
  displayPeriodNo,
  displaySlotNo,
  isPassphraseShape,
  jstClock,
  monitorChips,
  monitorPhase,
  REFRESH_DELAY_SECONDS,
  REFRESH_MINUTES,
  secondsUntilNextRefresh,
} from "@/lib/domain/monitor";

// S30 モニター (外部設計書 06-4, R6-4, R6-5): いま・次の判定、更新の時刻、合言葉の形、
// フロアマップの図と文字の置き方。

const at = (hour: number, minute: number) => hour * 60 + minute;

describe("いま授業中か、休み時間か (monitorPhase)", () => {
  it("授業中は、時限と枠 (前半・後半) が分かる", () => {
    expect(monitorPhase(at(9, 15))).toEqual({
      kind: "lesson",
      periodNo: 1,
      slotNo: 1,
      nextPeriodNo: 2,
    });
    expect(monitorPhase(at(10, 0))).toMatchObject({
      kind: "lesson",
      periodNo: 1,
      slotNo: 2,
    });
    expect(monitorPhase(at(10, 44))).toMatchObject({
      kind: "lesson",
      slotNo: 2,
    });
    expect(monitorPhase(at(13, 30))).toMatchObject({
      kind: "lesson",
      periodNo: 3,
      slotNo: 5,
    });
    expect(monitorPhase(at(16, 0))).toMatchObject({
      kind: "lesson",
      periodNo: 4,
      slotNo: 8,
      nextPeriodNo: null,
    });
  });

  it("休み時間・昼休み・最初の授業の前は、次の時限 (break)", () => {
    expect(monitorPhase(at(8, 0))).toEqual({ kind: "break", nextPeriodNo: 1 });
    expect(monitorPhase(at(9, 14))).toEqual({ kind: "break", nextPeriodNo: 1 });
    expect(monitorPhase(at(10, 45))).toEqual({
      kind: "break",
      nextPeriodNo: 2,
    });
    expect(monitorPhase(at(12, 30))).toEqual({
      kind: "break",
      nextPeriodNo: 3,
    });
    expect(monitorPhase(at(13, 29))).toEqual({
      kind: "break",
      nextPeriodNo: 3,
    });
    expect(monitorPhase(at(15, 0))).toEqual({ kind: "break", nextPeriodNo: 4 });
  });

  it("前半と後半の間 (10:00 など) は、休み時間ではない", () => {
    for (const minutes of [at(10, 0), at(11, 45), at(14, 15), at(16, 0)]) {
      expect(monitorPhase(minutes).kind, String(minutes)).toBe("lesson");
    }
  });

  it("4限が終わったあとは ended", () => {
    expect(monitorPhase(at(16, 45))).toEqual({ kind: "ended" });
    expect(monitorPhase(at(23, 59))).toEqual({ kind: "ended" });
  });
});

describe("画面に出す時限・枠・ラベル", () => {
  it("授業中はいまの時限と枠、休み時間は次の時限の前半、終わったあとは出さない", () => {
    expect(displayPeriodNo(monitorPhase(at(10, 30)))).toBe(1);
    expect(displaySlotNo(monitorPhase(at(10, 30)))).toBe(2);
    expect(displayPeriodNo(monitorPhase(at(10, 50)))).toBe(2);
    expect(displaySlotNo(monitorPhase(at(10, 50)))).toBe(3);
    expect(displayPeriodNo(monitorPhase(at(17, 0)))).toBeNull();
    expect(displaySlotNo(monitorPhase(at(17, 0)))).toBeNull();
  });

  it("上の帯: 授業中は いま・次、休み時間は 休み時間・次は、終わったあとは 終了", () => {
    expect(monitorChips(monitorPhase(at(10, 30)))).toEqual({
      primary: { tone: "lesson", text: "いま 1限 9:15〜10:45" },
      secondary: "次 2限 11:00",
    });
    expect(monitorChips(monitorPhase(at(10, 50)))).toEqual({
      primary: { tone: "break", text: "休み時間" },
      secondary: "次は 2限 11:00",
    });
    expect(monitorChips(monitorPhase(at(16, 10)))).toEqual({
      primary: { tone: "lesson", text: "いま 4限 15:15〜16:45" },
      secondary: "本日はこの授業が最後",
    });
    expect(monitorChips(monitorPhase(at(17, 0)))).toEqual({
      primary: { tone: "ended", text: "本日の授業は終了" },
      secondary: null,
    });
  });
});

describe("データを取りに行く時刻 (06-4)", () => {
  it("8:00 と枠の境目の 13 回", () => {
    expect(REFRESH_MINUTES).toEqual([
      at(8, 0),
      at(9, 15),
      at(10, 0),
      at(10, 45),
      at(11, 0),
      at(11, 45),
      at(12, 30),
      at(13, 30),
      at(14, 15),
      at(15, 0),
      at(15, 15),
      at(16, 0),
      at(16, 45),
    ]);
    expect(REFRESH_MINUTES).toHaveLength(13);
  });

  it("次の時刻まで: 境目の数秒後を待つ", () => {
    expect(REFRESH_DELAY_SECONDS).toBeGreaterThan(0);
    // 9:14:50 → 9:15:05 まで 15 秒
    expect(secondsUntilNextRefresh(at(9, 14) * 60 + 50)).toBe(15);
    // ちょうど境目 (9:15:00) は、まだ取りに行く前。5 秒後
    expect(secondsUntilNextRefresh(at(9, 15) * 60)).toBe(REFRESH_DELAY_SECONDS);
    // 取りに行った直後 (9:15:05) は、次の 10:00:05 まで
    expect(secondsUntilNextRefresh(at(9, 15) * 60 + 5)).toBe(
      (at(10, 0) - at(9, 15)) * 60,
    );
  });

  it("最後の 16:45 のあとは、翌日の 8:00 まで。8:00 の前は、その日の 8:00 まで", () => {
    expect(secondsUntilNextRefresh(at(16, 45) * 60 + 5)).toBe(
      (24 * 60 - at(16, 45) + at(8, 0)) * 60,
    );
    expect(secondsUntilNextRefresh(at(23, 59) * 60)).toBe(
      (24 * 60 - at(23, 59) + at(8, 0)) * 60 + REFRESH_DELAY_SECONDS,
    );
    expect(secondsUntilNextRefresh(at(3, 0) * 60)).toBe(
      (at(8, 0) - at(3, 0)) * 60 + REFRESH_DELAY_SECONDS,
    );
  });
});

describe("合言葉の形", () => {
  it("32文字以上 64文字以下の A-Z a-z 0-9 - _ だけ", () => {
    expect(isPassphraseShape("a".repeat(32))).toBe(true);
    expect(isPassphraseShape("Ab0-_".repeat(7))).toBe(true);
    expect(isPassphraseShape("a".repeat(64))).toBe(true);
  });
  it("短い・長い・使えない文字・文字でないものは、形が違う (DB に問い合わせない)", () => {
    for (const value of [
      "a".repeat(31),
      "a".repeat(65),
      `${"a".repeat(31)}/`,
      `${"a".repeat(31)}.`,
      `${"a".repeat(31)}%`,
      `${"a".repeat(31)} `,
      "",
      null,
      undefined,
      12345,
      ["a".repeat(32)],
    ]) {
      expect(isPassphraseShape(value), String(value)).toBe(false);
    }
  });
});

describe("画面の時計 (日本時間)", () => {
  it("サーバーが UTC でも、日本時間の日付・時刻・曜日になる", () => {
    // 2026-11-13(金) 01:30:45 UTC = 10:30:45 JST
    expect(jstClock(new Date("2026-11-13T01:30:45Z"))).toEqual({
      dateText: "11/13(金)",
      timeText: "10:30",
      secondsOfDay: at(10, 30) * 60 + 45,
    });
  });
  it("日付の境目: UTC の 15:00 は、日本では翌日の 0:00", () => {
    expect(jstClock(new Date("2026-11-13T15:00:00Z"))).toEqual({
      dateText: "11/14(土)",
      timeText: "0:00",
      secondsOfDay: 0,
    });
    expect(jstClock(new Date("2026-11-13T14:59:59Z"))).toMatchObject({
      dateText: "11/13(金)",
      timeText: "23:59",
    });
  });
});

describe("フロアマップの図", () => {
  const rooms = FLOORS.flatMap((floor) => floor.rooms);

  it("6階分。状態の色が付く教室は 21 室で、名前は重ならない", () => {
    expect(FLOORS.map((floor) => floor.id)).toEqual([
      "6F",
      "5F",
      "4F",
      "3F",
      "2F",
      "1F",
    ]);
    expect(PLAN_ROOM_NAMES).toHaveLength(21);
    expect(new Set(PLAN_ROOM_NAMES).size).toBe(21);
    expect([...PLAN_ROOM_NAMES].sort()).toEqual(
      [
        "101",
        "201",
        "202",
        "203",
        "301",
        "302",
        "303",
        "304",
        "305",
        "401",
        "402",
        "403",
        "501",
        "502",
        "503",
        "504",
        "505",
        "601",
        "602",
        "603",
        "604",
      ].sort(),
    );
  });

  it("どの部屋も、建物の外枠の外にはみ出さない", () => {
    for (const floor of FLOORS) {
      const outline = boundsOf(floor.outline);
      for (const room of floor.rooms) {
        const b = boundsOf(room.points);
        expect(b.x0, `${floor.id} ${room.name}`).toBeGreaterThanOrEqual(
          outline.x0 - 0.01,
        );
        expect(b.x1, `${floor.id} ${room.name}`).toBeLessThanOrEqual(
          outline.x1 + 0.01,
        );
        expect(b.y0, `${floor.id} ${room.name}`).toBeGreaterThanOrEqual(
          outline.y0 - 0.01,
        );
        expect(b.y1, `${floor.id} ${room.name}`).toBeLessThanOrEqual(
          outline.y1 + 0.01,
        );
      }
    }
  });

  it("3〜6階の ○01・○02・○03 の教室は、高さが同じ", () => {
    for (const id of ["6F", "5F", "4F", "3F"]) {
      const floor = FLOORS.find((item) => item.id === id)!;
      const heights = floor.rooms
        .filter((room) => /^[3-6]0[123]$/.test(room.name))
        .map((room) => {
          const b = boundsOf(room.points);
          return b.y1 - b.y0;
        });
      expect(heights, id).toHaveLength(3);
      expect(new Set(heights).size, id).toBe(1);
    }
  });

  it("図の中に、図形でない・つぶれた部屋がない", () => {
    for (const room of rooms) {
      expect(room.points.length, room.name).toBeGreaterThanOrEqual(4);
      const b = boundsOf(room.points);
      expect(b.x1 - b.x0, room.name).toBeGreaterThan(10);
      expect(b.y1 - b.y0, room.name).toBeGreaterThan(10);
    }
  });
});

describe("フロアマップの文字の置き方", () => {
  it("文字の幅: 全角は 1em、半角は 0.58em", () => {
    expect(estimateWidth("ABC", 10)).toBeCloseTo(17.4);
    expect(estimateWidth("教室", 10)).toBe(20);
  });

  it("長い文字は、同じ長さに近い行に分ける。入るならそのまま", () => {
    expect(balanceLines("医療情報1年", 17, 200)).toEqual(["医療情報1年"]);
    const lines = balanceLines("ゲームITエキスパート2年", 17, 120);
    expect(lines.length).toBe(2);
    expect(lines.join("")).toBe("ゲームITエキスパート2年");
    for (const line of lines) {
      expect(estimateWidth(line, 17)).toBeLessThanOrEqual(120);
    }
  });

  it("重心と、高さごとの左右の端 (斜めの壁)", () => {
    const square = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ] as const;
    expect(centroid(square)).toEqual([5, 5]);
    const slant = [
      [0, 0],
      [100, 0],
      [100, 100],
      [50, 100],
    ] as const;
    const [left, right] = extentAt(slant, 50);
    expect(left).toBeCloseTo(25);
    expect(right).toBeCloseTo(100);
  });

  it("授業の文字は、どの教室でも項目ごとに同じ大きさで、教室の中に収まる", () => {
    const lesson = {
      className: "ゲームITエキスパート2年",
      subject: "ゲーム設計",
      teacher: "太田",
    };
    for (const floor of FLOORS) {
      for (const room of floor.rooms.filter((r) => r.kind === "room")) {
        const points = room.points.map(
          ([x, y]) => [x * SCALE, y * SCALE] as const,
        );
        const [cx, cy] = centroid(points);
        const layout = lessonLayout(points, [cx, cy], room.name, lesson);
        const sizes = new Set(layout.lines.map((line) => line.size));
        // 使う大きさは、決めた 4 種類だけ (教室ごとに縮めない)
        for (const size of sizes) {
          expect([FONT.num, FONT.cls, FONT.sub, FONT.tch]).toContain(size);
        }
        expect(layout.lines[0]).toMatchObject({
          text: room.name,
          size: FONT.num,
        });
        const b = boundsOf(points);
        for (const line of layout.lines) {
          expect(line.y, `${room.name} ${line.text}`).toBeGreaterThan(b.y0);
          expect(line.y, `${room.name} ${line.text}`).toBeLessThan(b.y1);
        }
      }
    }
  });
});
