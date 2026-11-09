import { describe, expect, it } from "vitest";
import {
  findCurrentAndNext,
  isEntered,
  lessonSlotsByRoom,
  type MonthStates,
} from "@/lib/domain/timetable-read";

const states = (
  entries: [string, { imported: boolean; nextLastInputDate: string | null }][],
): MonthStates => new Map(entries);

describe("isEntered (R3-7)", () => {
  const nov = states([
    ["2026-11", { imported: true, nextLastInputDate: "2026-12-03" }],
  ]);

  it("その月のファイルが取り込み済みなら、月全体が入力済み", () => {
    expect(isEntered("2026-11-01", nov)).toBe(true);
    expect(isEntered("2026-11-30", nov)).toBe(true);
  });

  it("前の月のファイルの、翌月の最終入力日までは入力済み(仮の時間割)。その先は未定", () => {
    expect(isEntered("2026-12-01", nov)).toBe(true);
    expect(isEntered("2026-12-03", nov)).toBe(true);
    expect(isEntered("2026-12-04", nov)).toBe(false);
    expect(isEntered("2026-12-15", nov)).toBe(false);
  });

  it("翌月の最終入力日が空なら、翌月は未定。前の前の月は関係しない", () => {
    const none = states([
      ["2026-11", { imported: true, nextLastInputDate: null }],
    ]);
    expect(isEntered("2026-12-01", none)).toBe(false);
    expect(isEntered("2027-01-01", nov)).toBe(false);
    expect(isEntered("2026-10-31", nov)).toBe(false);
  });

  it("例外解除だけの行(取り込んでいない)は、入力済みにしない", () => {
    const unlocked = states([
      ["2026-11", { imported: false, nextLastInputDate: null }],
    ]);
    expect(isEntered("2026-11-10", unlocked)).toBe(false);
  });

  it("その月のファイルがあれば、前の月の仮の時間割がなくても入力済み", () => {
    const both = states([
      ["2026-11", { imported: true, nextLastInputDate: "2026-12-03" }],
      ["2026-12", { imported: true, nextLastInputDate: null }],
    ]);
    expect(isEntered("2026-12-20", both)).toBe(true);
  });
});

describe("findCurrentAndNext (R6-2, R6-4)", () => {
  const at = (hour: number, minute: number) => hour * 60 + minute;
  const lesson = (
    date: string,
    start: string,
    over: { cancelled?: boolean } = {},
  ) => {
    const [h, m] = start.split(":").map(Number);
    return {
      id: `${date}-${start}`,
      date,
      startMinutes: at(h, m),
      endMinutes: at(h, m) + 90,
      cancelled: false,
      ...over,
    };
  };
  const lessons = [
    lesson("2026-11-06", "9:15"),
    lesson("2026-11-06", "11:00"),
    lesson("2026-11-06", "13:30"),
    lesson("2026-11-09", "9:15"),
    lesson("2026-11-09", "11:00"),
  ];
  const all = () => true;
  const find = (
    minutes: number,
    over: { isEntered?: (date: string) => boolean } = {},
  ) =>
    findCurrentAndNext({
      today: "2026-11-06",
      minutes,
      lessons,
      isEntered: all,
      ...over,
    });

  it("授業中は、いまの授業と、次の授業", () => {
    expect(find(at(9, 30))).toMatchObject({
      kind: "ready",
      current: { id: "2026-11-06-9:15" },
      next: { id: "2026-11-06-11:00" },
    });
  });

  it("休み時間・昼休みは、いまの授業がなく、次の授業を出す。最初の授業の前は、最初の授業", () => {
    expect(find(at(10, 50))).toMatchObject({
      current: null,
      next: { id: "2026-11-06-11:00" },
    });
    expect(find(at(12, 45))).toMatchObject({
      current: null,
      next: { id: "2026-11-06-13:30" },
    });
    expect(find(at(7, 0))).toMatchObject({
      current: null,
      next: { id: "2026-11-06-9:15" },
    });
  });

  it("開始の時刻ちょうどは、その授業がいまの授業(終了ちょうどは、いまではない)", () => {
    expect(find(at(11, 0))).toMatchObject({
      current: { id: "2026-11-06-11:00" },
    });
    expect(find(at(10, 45))).toMatchObject({ current: null });
  });

  it("最後の授業が始まったあとは、翌日以降の最初の授業(土日は飛ばす)", () => {
    expect(find(at(13, 30))).toMatchObject({
      current: { id: "2026-11-06-13:30" },
      next: { id: "2026-11-09-9:15" },
    });
    expect(find(at(16, 0))).toMatchObject({
      current: null,
      next: { id: "2026-11-09-9:15" },
    });
  });

  it("休講の授業は、いまにも次にも含めない", () => {
    const result = findCurrentAndNext({
      today: "2026-11-06",
      minutes: at(9, 30),
      lessons: lessons.map((l) =>
        l.id === "2026-11-06-9:15" || l.id === "2026-11-06-11:00"
          ? { ...l, cancelled: true }
          : l,
      ),
      isEntered: all,
    });
    expect(result).toMatchObject({
      current: null,
      next: { id: "2026-11-06-13:30" },
    });
  });

  it("今日が未定なら、何も言えない(未定)", () => {
    expect(find(at(9, 30), { isEntered: () => false })).toEqual({
      kind: "undecided",
    });
  });

  it("次の授業の探索は、未定の日で止まる", () => {
    const upToSunday = (date: string) => date <= "2026-11-08";
    expect(find(at(16, 0), { isEntered: upToSunday })).toEqual({
      kind: "ready",
      current: null,
      next: null,
    });
  });

  it("60日先までは探す。61日先は探さない", () => {
    const search = (date: string) =>
      findCurrentAndNext({
        today: "2026-11-06",
        minutes: at(16, 0),
        lessons: [lesson(date, "9:15")],
        isEntered: all,
      });
    expect(search("2027-01-05")).toMatchObject({
      next: { id: "2027-01-05-9:15" },
    }); // 60 days ahead
    expect(search("2027-01-06")).toMatchObject({ next: null }); // 61 days ahead
  });
});

describe("lessonSlotsByRoom (R4-1 の授業)", () => {
  const lesson = (
    roomId: string | null,
    className: string,
    start: number,
    end: number,
    cancelled = false,
  ) => ({ roomId, className, startMinutes: start, endMinutes: end, cancelled });

  it("1限(9:15-10:45)は、1限の前半・後半の2枠を取る", () => {
    const slots = lessonSlotsByRoom([lesson("r1", "A1年", 555, 645)]).get(
      "r1",
    )!;
    expect(slots[1]).toEqual({ kind: "lesson", className: "A1年" });
    expect(slots[2]).toEqual({ kind: "lesson", className: "A1年" });
    expect(slots[3]).toEqual({ kind: "free" });
  });

  it("終わりと始まりが同じ時刻なら、重ならない(2限の前半は11:00から)", () => {
    const slots = lessonSlotsByRoom([lesson("r1", "A1年", 555, 660)]).get(
      "r1",
    )!;
    expect(slots[2].kind).toBe("lesson");
    expect(slots[3].kind).toBe("free");
  });

  it("休講・教室なし(教室未定)は取らない", () => {
    expect(
      lessonSlotsByRoom([
        lesson("r1", "A1年", 555, 645, true),
        lesson(null, "A1年", 555, 645),
      ]).size,
    ).toBe(0);
  });

  it("合同: 同じ教室・同じ時間の複数のクラスは、まとめて出す", () => {
    const slots = lessonSlotsByRoom([
      lesson("r1", "A1年", 555, 645),
      lesson("r1", "B1年", 555, 645),
      lesson("r1", "A1年", 555, 645),
    ]).get("r1")!;
    expect(slots[1]).toEqual({ kind: "lesson", className: "A1年、B1年" });
  });

  it("別の教室には影響しない", () => {
    const rooms = lessonSlotsByRoom([
      lesson("r1", "A1年", 555, 645),
      lesson("r2", "B1年", 660, 750),
    ]);
    expect(rooms.get("r2")![1].kind).toBe("free");
    expect(rooms.get("r2")![3]).toEqual({ kind: "lesson", className: "B1年" });
  });
});
