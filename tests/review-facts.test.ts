import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  lessonsInBlocks,
  reservationsTouchedByLessons,
} from "@/lib/domain/reservation-core";

// loadApprovalFacts: the facts an approval is decided on, read from a stand-in database.

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
  lesson: { findMany: vi.fn() },
  reservation: { findMany: vi.fn() },
  roomBlock: { findMany: vi.fn() },
  schoolClass: { findMany: vi.fn() },
}));
vi.mock("@/lib/server/db", () => ({ getDb: () => db }));
vi.mock("@/lib/server/queries/common", () => ({
  inYear: () => ({}),
}));
const lessonsModule = vi.hoisted(() => ({ loadMonthStates: vi.fn() }));
vi.mock("@/lib/server/queries/lessons", () => ({
  loadMonthStates: lessonsModule.loadMonthStates,
  monthsAround: () => ["2026-11", "2026-10"],
  NO_STATES: new Map(),
}));
vi.mock("@/lib/server/queries/reservations", () => ({
  PAGE_SIZE: 50,
  toStored: (status: string) => status.toLowerCase(),
}));

import { loadApprovalFacts } from "@/lib/server/queries/review";

const ROOM = "room-304";
const NOW = new Date("2026-11-10T00:00:00Z");
const day = (date: string) => new Date(`${date}T00:00:00Z`);

beforeEach(() => {
  vi.clearAllMocks();
  db.lesson.findMany.mockResolvedValue([]);
  db.reservation.findMany.mockResolvedValue([]);
  db.roomBlock.findMany.mockResolvedValue([]);
  db.schoolClass.findMany.mockResolvedValue([
    { id: "c-a", name: "A組", homeRoomId: ROOM },
    { id: "c-b", name: "B組", homeRoomId: "room-other" },
  ]);
  // Both classes have the file of November: the day is 入力済み.
  const imported = new Map([
    ["2026-11", { imported: true, nextLastInputDate: null }],
  ]);
  lessonsModule.loadMonthStates.mockResolvedValue(
    new Map([
      ["c-a", imported],
      ["c-b", imported],
    ]),
  );
});

const entry = (over: Record<string, unknown> = {}) => ({
  key: "e",
  roomId: ROOM,
  date: "2026-11-16",
  slots: [5, 6] as never,
  ...over,
});
const facts = async (over: Record<string, unknown> = {}) =>
  (await loadApprovalFacts([entry(over)], NOW)).get("e")!;

describe("loadApprovalFacts", () => {
  it("何もなければ、問題なし", async () => {
    expect(await facts()).toMatchObject({
      undecidedClasses: [],
      otherPending: 0,
      otherApproved: false,
      homeroomClassesWithUndecidedLesson: [],
    });
    expect((await facts()).fixedSlotStatuses[5].kind).toBe("free");
  });

  it("その日が未定のクラスの名前を返す(ME201)", async () => {
    lessonsModule.loadMonthStates.mockResolvedValue(
      new Map([
        [
          "c-a",
          new Map([["2026-11", { imported: true, nextLastInputDate: null }]]),
        ],
      ]),
    );
    expect((await facts()).undecidedClasses).toEqual(["B組"]);
  });

  it("授業と使用止めを、いまの状態で返す(ME202、ME203)", async () => {
    db.lesson.findMany.mockResolvedValue([
      {
        date: day("2026-11-16"),
        classId: "c-b",
        roomId: ROOM,
        kind: "FIXED",
        startMinutes: 13 * 60 + 30,
        endMinutes: 14 * 60 + 15,
        cancelled: false,
        class: { name: "B組" },
      },
    ]);
    db.roomBlock.findMany.mockResolvedValue([
      {
        roomId: ROOM,
        startDate: day("2026-11-16"),
        startPeriod: 4,
        endDate: day("2026-11-16"),
        endPeriod: 4,
      },
    ]);
    const result = await facts({ slots: [5, 6, 7, 8] });
    expect(result.fixedSlotStatuses[5].kind).toBe("lesson");
    expect(result.fixedSlotStatuses[6].kind).toBe("free");
    expect(result.fixedSlotStatuses[7].kind).toBe("blocked");
  });

  it("休講の授業は、数えない", async () => {
    db.lesson.findMany.mockResolvedValue([
      {
        date: day("2026-11-16"),
        classId: "c-b",
        roomId: ROOM,
        kind: "FIXED",
        startMinutes: 13 * 60 + 30,
        endMinutes: 15 * 60,
        cancelled: true,
        class: { name: "B組" },
      },
    ]);
    expect((await facts()).fixedSlotStatuses[5].kind).toBe("free");
  });

  it("ほかの承認待ち(件数)と承認済みを、自分を除いて数える(MW201、MW202)", async () => {
    const row = (
      id: string,
      status: string,
      slots: number[],
      date = "2026-11-16",
    ) => ({
      id,
      roomId: ROOM,
      date: day(date),
      status,
      slots: slots.map((slot) => ({ slot })),
    });
    db.reservation.findMany.mockResolvedValue([
      row("self", "PENDING", [5, 6]),
      row("p1", "PENDING", [6]),
      row("p2", "PENDING", [5]),
      row("elsewhere", "PENDING", [1]), // 重ならない枠
      row("other-day", "APPROVED", [5], "2026-11-17"),
    ]);
    const result = await facts({ selfId: "self" });
    expect(result.otherPending).toBe(2);
    expect(result.otherApproved).toBe(false);

    db.reservation.findMany.mockResolvedValue([row("a1", "APPROVED", [6, 7])]);
    expect((await facts()).otherApproved).toBe(true);
  });

  it("期限切れの承認待ちは、数えない", async () => {
    const started = new Date("2026-11-16T04:30:00Z"); // 3限が始まった
    db.reservation.findMany.mockResolvedValue([
      {
        id: "old",
        roomId: ROOM,
        date: day("2026-11-16"),
        status: "PENDING",
        slots: [{ slot: 5 }],
      },
    ]);
    const result = (await loadApprovalFacts([entry()], started)).get("e")!;
    expect(result.otherPending).toBe(0);
  });

  it("ホームルーム教室で、そのクラスに教室未定の授業が重なるとき(MW203)", async () => {
    db.lesson.findMany.mockResolvedValue([
      {
        date: day("2026-11-16"),
        classId: "c-a", // 304 がホームルームのクラス
        roomId: null,
        kind: "ROOM_TBD",
        startMinutes: 13 * 60 + 30,
        endMinutes: 15 * 60,
        cancelled: false,
        class: { name: "A組" },
      },
      {
        date: day("2026-11-16"),
        classId: "c-b", // ほかの教室のクラス: 関係ない
        roomId: null,
        kind: "ROOM_TBD",
        startMinutes: 13 * 60 + 30,
        endMinutes: 15 * 60,
        cancelled: false,
        class: { name: "B組" },
      },
    ]);
    expect((await facts()).homeroomClassesWithUndecidedLesson).toEqual(["A組"]);
    // 時間が重ならなければ、出さない
    expect(
      (await facts({ slots: [1, 2] })).homeroomClassesWithUndecidedLesson,
    ).toEqual([]);
  });
});

describe("取り込みと予約の重なり (MW402、MW403)", () => {
  const lesson = (
    date: string,
    start: string,
    end: string,
    room: string | null,
  ) => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return {
      date,
      startMinutes: sh * 60 + sm,
      endMinutes: eh * 60 + em,
      room,
    };
  };

  it("承認済みの予約と、同じ教室・同じ日・時間が重なる授業を、予約の数で数える", () => {
    const reservations = [
      { id: "1", room: "304", date: "2026-11-16", slots: [5, 6] as never },
      { id: "2", room: "304", date: "2026-11-16", slots: [1] as never },
      { id: "3", room: "305", date: "2026-11-16", slots: [5] as never },
    ];
    expect(
      reservationsTouchedByLessons(
        [
          lesson("2026-11-16", "13:30", "15:00", "304"),
          lesson("2026-11-16", "14:00", "15:00", "304"), // 同じ予約に2つ重なっても1件
        ],
        reservations,
      ),
    ).toBe(1);
  });

  it("終わりと始まりが同じ時刻なら重ならない。教室未定・別の日は重ならない", () => {
    const reservations = [
      { id: "1", room: "304", date: "2026-11-16", slots: [5] as never },
    ];
    expect(
      reservationsTouchedByLessons(
        [lesson("2026-11-16", "12:00", "13:30", "304")],
        reservations,
      ),
    ).toBe(0);
    expect(
      reservationsTouchedByLessons(
        [
          lesson("2026-11-16", "13:30", "15:00", null),
          lesson("2026-11-17", "13:30", "15:00", "304"),
        ],
        reservations,
      ),
    ).toBe(0);
  });

  it("使用止めの時限に入る授業を数える", () => {
    const block = {
      room: "304",
      startDate: "2026-11-16",
      startPeriod: 3 as const,
      endDate: "2026-11-16",
      endPeriod: 3 as const,
    };
    expect(
      lessonsInBlocks(
        [
          lesson("2026-11-16", "13:30", "15:00", "304"),
          lesson("2026-11-16", "11:00", "12:30", "304"),
          lesson("2026-11-16", "13:30", "15:00", "305"),
          lesson("2026-11-16", "13:30", "15:00", null),
        ],
        [block],
      ),
    ).toBe(1);
  });
});
