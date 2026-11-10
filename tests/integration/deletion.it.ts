import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { textToDateColumn } from "@/lib/domain/school-date";
import { MESSAGES } from "@/lib/messages";
import { closeDatabase, resetDatabase, testDb } from "./support/db";
import { ID, USERS, seedBase } from "./support/fixtures";

// T-DEL-004/007/008: what a deletion takes with it, and what keeps it from being done, on a real
// database (the foreign keys decide; テスト設計書 4-6). "Now" is 2026-11-10 10:00 Japan time.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/db", async () => {
  const { testDb } = await import("./support/db");
  return { getDb: () => testDb() };
});

import { deleteMaster } from "@/lib/server/deletion";

const NOW = new Date("2026-11-10T10:00:00+09:00");
const date = textToDateColumn;

const OLD_ROOM = "00000000-0000-4000-8000-0000000000a1";
const OLD_CLASS = "00000000-0000-4000-8000-0000000000b1";

beforeEach(async () => {
  await resetDatabase();
  await seedBase();
});

afterAll(async () => {
  await closeDatabase();
});

async function oldRoom() {
  const db = testDb();
  await db.room.create({
    data: { id: OLD_ROOM, name: "旧教室", kind: "FREE", active: false },
  });
  return db;
}

describe("教室の削除(R5-7)", () => {
  it("T-DEL-007 終わった予約・使用止め・受信機も消える。過去の授業は名前だけ残る", async () => {
    const db = await oldRoom();
    await db.lesson.create({
      data: {
        classId: ID.classA,
        date: date("2026-11-02"),
        startMinutes: 555,
        endMinutes: 645,
        subjectName: "プログラミング",
        roomId: OLD_ROOM,
        roomName: "旧教室",
        kind: "FIXED",
      },
    });
    await db.reservation.create({
      data: {
        roomId: OLD_ROOM,
        date: date("2026-11-02"),
        purpose: "自習",
        status: "APPROVED",
        applicantId: USERS.student.id,
        applicantName: USERS.student.name,
        slots: { create: [{ slot: 1 }] },
      },
    });
    await db.roomBlock.create({
      data: {
        roomId: OLD_ROOM,
        startDate: date("2026-11-02"),
        startPeriod: 1,
        endDate: date("2026-11-03"),
        endPeriod: 4,
        setByName: USERS.teacher.name,
      },
    });
    await db.receiver.create({ data: { receiverId: "304", roomId: OLD_ROOM } });

    expect(await deleteMaster("rooms", OLD_ROOM, "旧教室", NOW)).toEqual({
      kind: "deleted",
    });

    expect(await db.room.count({ where: { id: OLD_ROOM } })).toBe(0);
    expect(await db.reservation.count()).toBe(0);
    expect(await db.reservationSlot.count()).toBe(0);
    expect(await db.roomBlock.count()).toBe(0);
    expect(await db.receiver.count()).toBe(0);
    const lesson = await db.lesson.findFirstOrThrow();
    expect(lesson.roomId).toBeNull();
    expect(lesson.roomName).toBe("旧教室");
  });

  it("T-DEL-004 今日以降の授業・有効な予約・終わっていない使用止めがあれば、削除できない(ME512)", async () => {
    const db = await oldRoom();
    await db.lesson.create({
      data: {
        classId: ID.classA,
        date: date("2026-11-17"),
        startMinutes: 555,
        endMinutes: 645,
        subjectName: "プログラミング",
        roomId: OLD_ROOM,
        roomName: "旧教室",
        kind: "FIXED",
      },
    });
    await db.reservation.create({
      data: {
        roomId: OLD_ROOM,
        date: date("2026-11-18"),
        purpose: "自習",
        status: "PENDING",
        applicantId: USERS.student.id,
        applicantName: USERS.student.name,
        slots: { create: [{ slot: 1 }] },
      },
    });
    await db.roomBlock.create({
      data: {
        roomId: OLD_ROOM,
        startDate: date("2026-11-19"),
        startPeriod: 1,
        endDate: date("2026-11-20"),
        endPeriod: 4,
        setByName: USERS.teacher.name,
      },
    });

    const result = await deleteMaster("rooms", OLD_ROOM, "旧教室", NOW);
    expect(result).toEqual({
      kind: "refused",
      message: MESSAGES.ME512("今日以降の授業1件、有効な予約1件、使用止め1件"),
    });
    expect(await db.room.count({ where: { id: OLD_ROOM } })).toBe(1);
  });

  it("T-DEL-004 ホームルーム教室(終わったクラスを含む)は削除できない", async () => {
    const db = testDb();
    await db.room.update({
      where: { id: ID.roomHome },
      data: { active: false },
    });
    const result = await deleteMaster("rooms", ID.roomHome, "101", NOW);
    expect(result).toEqual({
      kind: "refused",
      message: MESSAGES.ME512("ホームルーム教室(システム専攻1年)"),
    });
    expect(await db.room.count({ where: { id: ID.roomHome } })).toBe(1);
  });

  it("T-DEL-003 名前が違えば ME511。有効のままなら ME512", async () => {
    const db = await oldRoom();
    expect(await deleteMaster("rooms", OLD_ROOM, "旧教 室", NOW)).toEqual({
      kind: "refused",
      message: MESSAGES.ME511,
    });
    await db.room.update({ where: { id: OLD_ROOM }, data: { active: true } });
    expect(await deleteMaster("rooms", OLD_ROOM, "旧教室", NOW)).toEqual({
      kind: "refused",
      message: MESSAGES.ME512("有効になっています。先に無効にしてください"),
    });
    expect(await db.room.count({ where: { id: OLD_ROOM } })).toBe(1);
  });
});

describe("クラスの削除(R5-7)", () => {
  it("T-DEL-008 過去の授業・取り込みの状況・クラスごとの休み・行事も消える", async () => {
    const db = testDb();
    await db.schoolClass.create({
      data: {
        id: OLD_CLASS,
        name: "旧クラス",
        homeRoomId: ID.roomHome,
        startYear: 2024,
        endYear: 2025,
        active: false,
      },
    });
    await db.lesson.create({
      data: {
        classId: OLD_CLASS,
        date: date("2026-11-02"),
        startMinutes: 555,
        endMinutes: 645,
        subjectName: "プログラミング",
        kind: "ROOM_TBD",
      },
    });
    await db.monthStatus.create({
      data: { classId: OLD_CLASS, month: "202611", importedAt: NOW },
    });
    await db.closure.create({
      data: {
        startDate: date("2026-11-20"),
        name: "校外学習",
        classId: OLD_CLASS,
        source: "TOOL",
        targetMonth: "202611",
      },
    });

    expect(await deleteMaster("classes", OLD_CLASS, "旧クラス", NOW)).toEqual({
      kind: "deleted",
    });

    expect(await db.schoolClass.count({ where: { id: OLD_CLASS } })).toBe(0);
    expect(await db.lesson.count({ where: { classId: OLD_CLASS } })).toBe(0);
    expect(await db.monthStatus.count({ where: { classId: OLD_CLASS } })).toBe(
      0,
    );
    expect(await db.closure.count({ where: { classId: OLD_CLASS } })).toBe(0);
    // The school-wide closures stay.
    expect(await db.closure.count()).toBe(3);
  });
});
