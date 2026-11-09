import { beforeEach, describe, expect, it, vi } from "vitest";
import { MESSAGES } from "@/lib/messages";

// 先生の操作 (承認・却下・取消・代理入力・使用止め). The database is replaced by a small
// stand-in so that what is written, and what is not, can be seen.

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
  room: { findFirst: vi.fn() },
  lesson: { findMany: vi.fn() },
  reservation: {
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  roomBlock: { create: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
}));
vi.mock("@/lib/server/db", () => ({ getDb: () => db }));
vi.mock("@/lib/server/queries/common", () => ({
  listSchoolClosures: vi.fn().mockResolvedValue([]),
}));
const facts = vi.hoisted(() => ({ loadApprovalFacts: vi.fn() }));
vi.mock("@/lib/server/queries/review", () => ({
  loadApprovalFacts: facts.loadApprovalFacts,
}));
const overlays = vi.hoisted(() => ({ loadDayOverlays: vi.fn() }));
vi.mock("@/lib/server/queries/reservations", () => ({
  loadDayOverlays: overlays.loadDayOverlays,
  toStored: (status: string) => status.toLowerCase(),
}));

import { ALL_FREE } from "@/lib/domain/room-status";
import {
  approveReservation,
  cancelReservation,
  createBlock,
  createProxyReservation,
  rejectReservation,
  releaseBlock,
} from "@/lib/server/teacher-actions";

const ROOM = "5b0f2f3a-8a4e-4a39-8a5c-1e6a0a1d3b11";
const ID = "9c1d7e22-0d0e-4a7e-9a55-0f7b1d2a8c33";
const TEACHER = {
  id: "teacher-1",
  name: "田村 先生",
  role: "teacher" as const,
};
const NOW = new Date("2026-11-10T00:00:00Z"); // 11/10 9:00 (Japan)

const found = (status: string, date = "2026-11-16", slots = [5, 6]) =>
  db.reservation.findUnique.mockResolvedValue({
    id: ID,
    roomId: ROOM,
    status,
    date: new Date(`${date}T00:00:00Z`),
    slots: slots.map((slot) => ({ slot })),
  });

const clean = {
  fixedSlotStatuses: { ...ALL_FREE },
  undecidedClasses: [] as string[],
  otherPending: 0,
  otherApproved: false,
  homeroomClassesWithUndecidedLesson: [] as string[],
};
const withFacts = (override: Partial<typeof clean> = {}) =>
  facts.loadApprovalFacts.mockResolvedValue(
    new Map([
      ["r", { ...clean, ...override }],
      ["p", { ...clean, ...override }],
    ]),
  );

beforeEach(() => {
  vi.clearAllMocks();
  withFacts();
  db.reservation.updateMany.mockResolvedValue({ count: 1 });
  db.reservation.create.mockResolvedValue({ id: "new-id" });
  db.room.findFirst.mockResolvedValue({ id: ROOM });
  db.lesson.findMany.mockResolvedValue([]);
  db.roomBlock.findMany.mockResolvedValue([]);
  db.reservation.findMany.mockResolvedValue([]);
  overlays.loadDayOverlays.mockResolvedValue({
    reservations: new Map(),
    blockedPeriods: new Map(),
  });
});

describe("approveReservation", () => {
  it("条件を満たせば承認する。対応した先生は、ログイン中の先生と今の時刻", async () => {
    found("PENDING");
    expect(await approveReservation(TEACHER, ID, false, NOW)).toEqual({
      kind: "done",
      notice: "MI201",
    });
    expect(db.reservation.updateMany).toHaveBeenCalledWith({
      where: { id: ID, status: "PENDING" },
      data: {
        status: "APPROVED",
        handledById: "teacher-1",
        handledByName: "田村 先生",
        handledAt: NOW,
      },
    });
  });

  it("未入力のクラスがあれば、承認しない(ME201、クラス名つき)", async () => {
    found("PENDING");
    withFacts({ undecidedClasses: ["A組", "B組"] });
    expect(await approveReservation(TEACHER, ID, false, NOW)).toEqual({
      kind: "refused",
      message: MESSAGES.ME201("A組、B組"),
    });
    expect(db.reservation.updateMany).not.toHaveBeenCalled();
  });

  it("あとから授業・使用止めが入っていれば、承認しない(ME202、ME203)", async () => {
    found("PENDING");
    withFacts({
      fixedSlotStatuses: {
        ...ALL_FREE,
        5: { kind: "lesson", className: "A組" },
      },
    });
    expect(await approveReservation(TEACHER, ID, false, NOW)).toMatchObject({
      kind: "refused",
      message: MESSAGES.ME202,
    });
    withFacts({ fixedSlotStatuses: { ...ALL_FREE, 6: { kind: "blocked" } } });
    expect(await approveReservation(TEACHER, ID, false, NOW)).toMatchObject({
      kind: "refused",
      message: MESSAGES.ME203,
    });
    expect(db.reservation.updateMany).not.toHaveBeenCalled();
  });

  it("最初の枠が始まっていたら、承認しない(ME204)", async () => {
    found("PENDING");
    expect(
      await approveReservation(
        TEACHER,
        ID,
        false,
        new Date("2026-11-16T04:30:00Z"),
      ),
    ).toEqual({ kind: "refused", message: MESSAGES.ME204 });
    expect(db.reservation.updateMany).not.toHaveBeenCalled();
  });

  it("同じ枠に承認済みがあれば、確認(MC201)が要る。確認したあとは承認できる", async () => {
    found("PENDING");
    withFacts({ otherApproved: true });
    expect(await approveReservation(TEACHER, ID, false, NOW)).toEqual({
      kind: "confirm",
      message: MESSAGES.MC201,
    });
    expect(db.reservation.updateMany).not.toHaveBeenCalled();
    expect(await approveReservation(TEACHER, ID, true, NOW)).toEqual({
      kind: "done",
      notice: "MI201",
    });
  });

  it("ほかの先生が先に対応していたら ME902(書かない / 書き込みが0件でも ME902)", async () => {
    found("REJECTED");
    expect(await approveReservation(TEACHER, ID, false, NOW)).toEqual({
      kind: "refused",
      message: MESSAGES.ME902,
    });
    expect(db.reservation.updateMany).not.toHaveBeenCalled();

    found("PENDING");
    db.reservation.updateMany.mockResolvedValue({ count: 0 });
    expect(await approveReservation(TEACHER, ID, false, NOW)).toEqual({
      kind: "refused",
      message: MESSAGES.ME902,
    });
  });

  it("存在しない・形が違う ID は not_found(DBに触らない)", async () => {
    db.reservation.findUnique.mockResolvedValue(null);
    expect(await approveReservation(TEACHER, ID, false, NOW)).toEqual({
      kind: "not_found",
    });
    db.reservation.findUnique.mockClear();
    for (const id of [undefined, null, 1, {}, "x'; DROP TABLE y;--"]) {
      expect(await approveReservation(TEACHER, id, false, NOW)).toEqual({
        kind: "not_found",
      });
    }
    expect(db.reservation.findUnique).not.toHaveBeenCalled();
  });
});

describe("rejectReservation / cancelReservation", () => {
  it("却下: 承認待ちで開始前なら却下する。条件つきの書き込み", async () => {
    found("PENDING");
    expect(await rejectReservation(TEACHER, ID, NOW)).toEqual({
      kind: "done",
      notice: "MI202",
    });
    expect(db.reservation.updateMany).toHaveBeenCalledWith({
      where: { id: ID, status: "PENDING" },
      data: expect.objectContaining({
        status: "REJECTED",
        handledById: "teacher-1",
      }),
    });
  });

  it("却下: 始まったら ME204、対応済みなら ME902", async () => {
    found("PENDING");
    expect(
      await rejectReservation(TEACHER, ID, new Date("2026-11-16T04:30:00Z")),
    ).toEqual({ kind: "refused", message: MESSAGES.ME204 });
    found("APPROVED");
    expect(await rejectReservation(TEACHER, ID, NOW)).toEqual({
      kind: "refused",
      message: MESSAGES.ME902,
    });
    expect(db.reservation.updateMany).not.toHaveBeenCalled();
  });

  it("取消: 承認済みを、開始前に取り消す", async () => {
    found("APPROVED");
    expect(await cancelReservation(TEACHER, ID, NOW)).toEqual({
      kind: "done",
      notice: "MI203",
    });
    expect(db.reservation.updateMany).toHaveBeenCalledWith({
      where: { id: ID, status: "APPROVED" },
      data: expect.objectContaining({ status: "CANCELLED" }),
    });
  });

  it("取消: 始まったら ME205(遅れて始めることがあるため)、承認済みでなければ ME902", async () => {
    found("APPROVED");
    expect(
      await cancelReservation(TEACHER, ID, new Date("2026-11-16T04:30:00Z")),
    ).toEqual({ kind: "refused", message: MESSAGES.ME205 });
    found("PENDING");
    expect(await cancelReservation(TEACHER, ID, NOW)).toEqual({
      kind: "refused",
      message: MESSAGES.ME902,
    });
    expect(db.reservation.updateMany).not.toHaveBeenCalled();
  });
});

describe("createProxyReservation (代理入力)", () => {
  const input = {
    roomId: ROOM,
    date: "2026-11-16",
    slots: ["5", "6"],
    purpose: "就活",
    note: "",
  };

  it("その場で承認済み。申請者も対応者も、ログイン中の先生。代理の印が付く", async () => {
    expect(await createProxyReservation(TEACHER, input, false, NOW)).toEqual({
      kind: "created",
      id: "new-id",
    });
    const data = db.reservation.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      status: "APPROVED",
      proxy: true,
      applicantId: "teacher-1",
      applicantName: "田村 先生",
      handledById: "teacher-1",
      handledByName: "田村 先生",
      handledAt: NOW,
    });
  });

  it("本文で申請者・状態を指定しても、使わない", async () => {
    await createProxyReservation(
      TEACHER,
      {
        ...input,
        applicantId: "x",
        status: "PENDING",
        proxy: false,
        handledById: "y",
      },
      false,
      NOW,
    );
    expect(db.reservation.create.mock.calls[0][0].data).toMatchObject({
      status: "APPROVED",
      proxy: true,
      applicantId: "teacher-1",
      handledById: "teacher-1",
    });
  });

  it("申請と同じ確認(締め切り・授業・使用止め)をする。通らなければ書かない", async () => {
    const late = await createProxyReservation(
      TEACHER,
      input,
      false,
      new Date("2026-11-13T03:00:00Z"), // 金曜 12:00
    );
    expect(late).toMatchObject({
      kind: "invalid",
      issues: [{ code: "ME101" }],
    });
    db.lesson.findMany.mockResolvedValue([
      {
        roomId: ROOM,
        startMinutes: 13 * 60 + 30,
        endMinutes: 15 * 60,
        cancelled: false,
        class: { name: "A組" },
      },
    ]);
    expect(
      await createProxyReservation(TEACHER, input, false, NOW),
    ).toMatchObject({
      issues: [{ code: "ME105" }],
    });
    expect(db.reservation.create).not.toHaveBeenCalled();
  });

  it("時間割が未定の日はできない(ME201)", async () => {
    withFacts({ undecidedClasses: ["A組"] });
    expect(
      await createProxyReservation(TEACHER, input, false, NOW),
    ).toMatchObject({
      kind: "invalid",
      issues: [{ code: "ME201", message: MESSAGES.ME201("A組") }],
    });
    expect(db.reservation.create).not.toHaveBeenCalled();
  });

  it("同じ枠に承認済みがあれば、確認(MC201)のあとに保存する", async () => {
    withFacts({ otherApproved: true });
    expect(await createProxyReservation(TEACHER, input, false, NOW)).toEqual({
      kind: "confirm",
      message: MESSAGES.MC201,
    });
    expect(db.reservation.create).not.toHaveBeenCalled();
    expect(await createProxyReservation(TEACHER, input, true, NOW)).toEqual({
      kind: "created",
      id: "new-id",
    });
  });
});

describe("使用止め", () => {
  const input = {
    roomId: ROOM,
    startDate: "2026-11-20",
    startPeriod: "3",
    endDate: "2026-11-21",
    endPeriod: "2",
  };

  it("設定できる。設定した先生の氏名をコピーして持ち、重なる数を返す(止めない)", async () => {
    db.reservation.findMany.mockResolvedValue([
      { date: new Date("2026-11-20T00:00:00Z"), slots: [{ slot: 5 }] },
      { date: new Date("2026-11-22T00:00:00Z"), slots: [{ slot: 5 }] },
    ]);
    db.lesson.findMany.mockResolvedValue([
      {
        date: new Date("2026-11-21T00:00:00Z"),
        startMinutes: 11 * 60,
        endMinutes: 12 * 60 + 30,
      },
    ]);
    expect(await createBlock(TEACHER, input, NOW)).toEqual({
      kind: "created",
      reservations: 1,
      lessons: 1,
    });
    expect(db.roomBlock.create.mock.calls[0][0].data).toMatchObject({
      roomId: ROOM,
      startPeriod: 3,
      endPeriod: 2,
      setById: "teacher-1",
      setByName: "田村 先生",
    });
    // 承認済みの予約は、自動では取り消さない
    expect(db.reservation.updateMany).not.toHaveBeenCalled();
  });

  it("終了が開始より前(ME301)、始まった時限(ME302)は設定できない", async () => {
    expect(
      await createBlock(TEACHER, { ...input, endDate: "2026-11-19" }, NOW),
    ).toEqual({ kind: "invalid", message: MESSAGES.ME301 });
    expect(
      await createBlock(
        TEACHER,
        {
          ...input,
          startDate: "2026-11-10",
          startPeriod: "1",
          endDate: "2026-11-10",
        },
        NOW, // 11/10 9:00 → 1限は 9:15 開始なので、まだ指定できる
      ),
    ).toMatchObject({ kind: "created" });
    db.roomBlock.create.mockClear();
    expect(
      await createBlock(
        TEACHER,
        {
          ...input,
          startDate: "2026-11-10",
          startPeriod: "1",
          endDate: "2026-11-10",
        },
        new Date("2026-11-10T00:15:00Z"), // 9:15 ちょうど = 始まった
      ),
    ).toEqual({ kind: "invalid", message: MESSAGES.ME302 });
    expect(db.roomBlock.create).not.toHaveBeenCalled();
  });

  it("無効・存在しない教室は ME109。形が違う入力・長すぎる期間は bad_request", async () => {
    db.room.findFirst.mockResolvedValue(null);
    expect(await createBlock(TEACHER, input, NOW)).toEqual({
      kind: "invalid",
      message: MESSAGES.ME109,
    });
    for (const raw of [
      null,
      {},
      { ...input, startPeriod: "5" },
      { ...input, startPeriod: "0" },
      { ...input, startDate: "2026-02-30" },
      { ...input, endDate: "2028-11-20" },
    ]) {
      expect(await createBlock(TEACHER, raw, NOW)).toEqual({
        kind: "bad_request",
      });
    }
    expect(db.roomBlock.create).not.toHaveBeenCalled();
  });

  it("解除: 行があれば消す。なければ not_found。形が違う ID は DB に触らない", async () => {
    db.roomBlock.deleteMany.mockResolvedValue({ count: 1 });
    expect(await releaseBlock(ID)).toBe("released");
    db.roomBlock.deleteMany.mockResolvedValue({ count: 0 });
    expect(await releaseBlock(ID)).toBe("not_found");
    db.roomBlock.deleteMany.mockClear();
    for (const id of [undefined, null, 5, "x' OR 1=1"]) {
      expect(await releaseBlock(id)).toBe("not_found");
    }
    expect(db.roomBlock.deleteMany).not.toHaveBeenCalled();
  });
});
