import { beforeEach, describe, expect, it, vi } from "vitest";
import { MESSAGES } from "@/lib/messages";

// 予約を書く処理 (createReservation, withdrawReservation). The database is replaced by a
// small stand-in so that what is written, and what is not, can be seen.

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
  room: { findFirst: vi.fn() },
  lesson: { findMany: vi.fn() },
  reservation: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
}));
vi.mock("@/lib/server/db", () => ({ getDb: () => db }));
vi.mock("@/lib/server/queries/common", () => ({
  listSchoolClosures: vi.fn().mockResolvedValue([]),
}));
const overlays = vi.hoisted(() => ({
  loadDayOverlays: vi.fn(),
}));
vi.mock("@/lib/server/queries/reservations", () => ({
  loadDayOverlays: overlays.loadDayOverlays,
  toStored: (status: string) => status.toLowerCase(),
}));

import {
  createReservation,
  withdrawReservation,
} from "@/lib/server/reservations";

const ROOM = "5b0f2f3a-8a4e-4a39-8a5c-1e6a0a1d3b11";
const RESERVATION = "9c1d7e22-0d0e-4a7e-9a55-0f7b1d2a8c33";
const USER = { id: "user-1", name: "山田 太郎", role: "student" as const };
const NOW = new Date("2026-11-10T00:00:00Z"); // 11/10 9:00 (Japan)
const valid = {
  roomId: ROOM,
  date: "2026-11-16", // Monday
  slots: ["5", "6"],
  purpose: "自習",
  note: "",
};

beforeEach(() => {
  vi.clearAllMocks();
  db.room.findFirst.mockResolvedValue({ id: ROOM });
  db.lesson.findMany.mockResolvedValue([]);
  db.reservation.create.mockResolvedValue({ id: "new-id" });
  overlays.loadDayOverlays.mockResolvedValue({
    reservations: new Map(),
    blockedPeriods: new Map(),
  });
});

describe("createReservation", () => {
  it("申請者はログイン中の人。承認待ちで、代理ではなく、氏名をコピーして持つ", async () => {
    const result = await createReservation(USER, valid, NOW);
    expect(result).toEqual({ kind: "created", id: "new-id" });
    expect(db.reservation.create).toHaveBeenCalledTimes(1);
    const data = db.reservation.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      roomId: ROOM,
      purpose: "自習",
      note: "",
      status: "PENDING",
      proxy: false,
      applicantId: "user-1",
      applicantName: "山田 太郎",
      slots: { create: [{ slot: 5 }, { slot: 6 }] },
    });
    expect(data.date.toISOString()).toBe("2026-11-16T00:00:00.000Z");
  });

  it("本文に申請者・状態・代理の印があっても、使わない", async () => {
    await createReservation(
      USER,
      {
        ...valid,
        applicantId: "someone-else",
        applicantName: "別の人",
        status: "APPROVED",
        proxy: true,
        handledById: "x",
      },
      NOW,
    );
    const data = db.reservation.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      applicantId: "user-1",
      applicantName: "山田 太郎",
      status: "PENDING",
      proxy: false,
    });
    expect(data).not.toHaveProperty("handledById");
  });

  it("確認に通らなければ、何も書かずに、項目ごとの文言を返す", async () => {
    const result = await createReservation(
      USER,
      { ...valid, slots: ["1", "3"], purpose: "", note: "あ".repeat(101) },
      NOW,
    );
    expect(db.reservation.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ kind: "invalid" });
    if (result.kind !== "invalid") return;
    expect(result.issues.map((i) => [i.code, i.field])).toEqual([
      ["ME104", "slots"],
      ["ME107", "purpose"],
      ["ME108", "note"],
    ]);
    expect(result.issues[1].message).toBe(MESSAGES.ME107);
  });

  it("締め切り・30日・過去を、サーバーの時刻で確かめる", async () => {
    const late = await createReservation(
      USER,
      valid,
      new Date("2026-11-13T03:00:00Z"), // 金曜 12:00(日本)
    );
    expect(late).toMatchObject({
      kind: "invalid",
      issues: [{ code: "ME101", field: "date" }],
    });
    const far = await createReservation(
      USER,
      { ...valid, date: "2026-12-14" },
      NOW,
    );
    expect(far).toMatchObject({ issues: [{ code: "ME102" }] });
    const past = await createReservation(
      USER,
      { ...valid, date: "2026-11-09" },
      NOW,
    );
    expect(past).toMatchObject({ issues: [{ code: "ME103" }] });
    expect(db.reservation.create).not.toHaveBeenCalled();
  });

  it("授業のある枠は ME105、使用止めの時限は ME106", async () => {
    db.lesson.findMany.mockResolvedValue([
      {
        roomId: ROOM,
        startMinutes: 13 * 60 + 30,
        endMinutes: 15 * 60,
        cancelled: false,
        class: { name: "A組" },
      },
    ]);
    const lesson = await createReservation(USER, valid, NOW);
    expect(lesson).toMatchObject({ issues: [{ code: "ME105" }] });

    db.lesson.findMany.mockResolvedValue([]);
    overlays.loadDayOverlays.mockResolvedValue({
      reservations: new Map(),
      blockedPeriods: new Map([[ROOM, new Set([3])]]),
    });
    const blocked = await createReservation(USER, valid, NOW);
    expect(blocked).toMatchObject({ issues: [{ code: "ME106" }] });
    expect(db.reservation.create).not.toHaveBeenCalled();
  });

  it("ほかの申請や承認済みがある枠にも、申請はできる(MW101、MW102)", async () => {
    overlays.loadDayOverlays.mockResolvedValue({
      reservations: new Map([
        [
          ROOM,
          [
            { status: "approved", date: "2026-11-16", slots: [5] },
            { status: "pending", date: "2026-11-16", slots: [6] },
          ],
        ],
      ]),
      blockedPeriods: new Map(),
    });
    expect(await createReservation(USER, valid, NOW)).toEqual({
      kind: "created",
      id: "new-id",
    });
  });

  it("無効な教室・存在しない教室・教室IDの形が違うものは ME109(DBを引かない)", async () => {
    db.room.findFirst.mockResolvedValue(null);
    const none = await createReservation(USER, valid, NOW);
    expect(none).toMatchObject({ issues: [{ code: "ME109", field: "room" }] });

    db.room.findFirst.mockClear();
    const bad = await createReservation(
      USER,
      { ...valid, roomId: "x'; DROP TABLE rooms;--" },
      NOW,
    );
    expect(bad).toMatchObject({ issues: [{ code: "ME109" }] });
    expect(db.room.findFirst).not.toHaveBeenCalled();
    expect(db.reservation.create).not.toHaveBeenCalled();
  });

  it("形が違う入力は bad_request(DBに触らない)", async () => {
    for (const raw of [
      null,
      "x",
      {},
      { ...valid, date: "2026-02-30" },
      { ...valid, slots: ["9"] },
      { ...valid, slots: "5" },
      { ...valid, purpose: 1 },
    ]) {
      expect(await createReservation(USER, raw, NOW)).toEqual({
        kind: "bad_request",
      });
    }
    expect(db.room.findFirst).not.toHaveBeenCalled();
  });

  it("枠は重ねず、並べて保存する。備考の前後の空白は取る", async () => {
    await createReservation(
      USER,
      { ...valid, slots: ["6", "5", "5"], note: "  メモ  " },
      NOW,
    );
    const data = db.reservation.create.mock.calls[0][0].data;
    expect(data.slots.create).toEqual([{ slot: 5 }, { slot: 6 }]);
    expect(data.note).toBe("メモ");
  });
});

describe("withdrawReservation", () => {
  const found = (status: string, date = "2026-11-16", slots = [5, 6]) =>
    db.reservation.findFirst.mockResolvedValue({
      date: new Date(`${date}T00:00:00Z`),
      status,
      slots: slots.map((slot) => ({ slot })),
    });

  it("自分の承認待ちを、開始前なら取り下げられる", async () => {
    found("PENDING");
    db.reservation.updateMany.mockResolvedValue({ count: 1 });
    expect(await withdrawReservation(USER, RESERVATION, NOW)).toEqual({
      kind: "withdrawn",
    });
    // 自分の予約・承認待ちのときだけ書き換える条件
    expect(db.reservation.updateMany).toHaveBeenCalledWith({
      where: { id: RESERVATION, applicantId: "user-1", status: "PENDING" },
      data: { status: "WITHDRAWN" },
    });
    expect(db.reservation.findFirst.mock.calls[0][0].where).toEqual({
      id: RESERVATION,
      applicantId: "user-1",
    });
  });

  it("人の予約や存在しない予約は not_found(書かない)", async () => {
    db.reservation.findFirst.mockResolvedValue(null);
    expect(await withdrawReservation(USER, RESERVATION, NOW)).toEqual({
      kind: "not_found",
    });
    for (const id of [
      undefined,
      null,
      5,
      {},
      "../etc",
      "x'; DROP TABLE y;--",
    ]) {
      expect(await withdrawReservation(USER, id, NOW)).toEqual({
        kind: "not_found",
      });
    }
    expect(db.reservation.updateMany).not.toHaveBeenCalled();
  });

  it("対応済み・始まったあとは ME110(書かない)", async () => {
    for (const status of ["APPROVED", "REJECTED", "CANCELLED", "WITHDRAWN"]) {
      found(status);
      expect(await withdrawReservation(USER, RESERVATION, NOW)).toEqual({
        kind: "refused",
        message: MESSAGES.ME110,
      });
    }
    found("PENDING");
    expect(
      await withdrawReservation(
        USER,
        RESERVATION,
        new Date("2026-11-16T04:30:00Z"), // 13:30 ちょうど = 3限が始まる
      ),
    ).toEqual({ kind: "refused", message: MESSAGES.ME110 });
    expect(db.reservation.updateMany).not.toHaveBeenCalled();
  });

  it("確認のあとに先生が先に対応していたら、書き換わらず ME110", async () => {
    found("PENDING");
    db.reservation.updateMany.mockResolvedValue({ count: 0 });
    expect(await withdrawReservation(USER, RESERVATION, NOW)).toEqual({
      kind: "refused",
      message: MESSAGES.ME110,
    });
  });
});
