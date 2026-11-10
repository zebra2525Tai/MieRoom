import { textToDateColumn } from "@/lib/domain/school-date";
import { testDb } from "./db";

// The fixed data every integration test starts from (テスト設計書 3-2). One room to book, one
// homeroom, one class, the school-wide closures of the demo data, and the test users.

export const ID = {
  roomFree: "00000000-0000-4000-8000-000000000001",
  roomHome: "00000000-0000-4000-8000-000000000002",
  classA: "00000000-0000-4000-8000-000000000010",
  teacher: "00000000-0000-4000-8000-000000000020",
} as const;

export type TestRole = "student" | "teacher" | "admin";

/** The signed-in people (the same shape as the app's CurrentUser). */
export const USERS = {
  student: { id: "u-student", name: "学生 一郎", role: "student" as TestRole },
  otherStudent: {
    id: "u-other-student",
    name: "学生 二郎",
    role: "student" as TestRole,
  },
  teacher: { id: "u-teacher", name: "先生 花子", role: "teacher" as TestRole },
  admin: { id: "u-admin", name: "管理 太郎", role: "admin" as TestRole },
} as const;

export const ROOM_FREE_NAME = "展示室";

/** Minutes from 0:00 of the periods (R3-1). */
export const PERIOD = {
  p1: { start: 9 * 60 + 15, end: 10 * 60 + 45 },
  p2: { start: 11 * 60, end: 12 * 60 + 30 },
} as const;

export async function seedBase(): Promise<void> {
  const db = testDb();
  for (const user of Object.values(USERS)) {
    await db.user.create({
      data: {
        id: user.id,
        name: user.name,
        email: `${user.id}@school.example`,
      },
    });
  }
  await db.room.createMany({
    data: [
      { id: ID.roomFree, name: ROOM_FREE_NAME, kind: "FREE" },
      { id: ID.roomHome, name: "101", kind: "HOMEROOM" },
    ],
  });
  await db.schoolClass.create({
    data: {
      id: ID.classA,
      name: "システム専攻1年",
      homeRoomId: ID.roomHome,
      startYear: 2026,
    },
  });
  await db.teacher.create({
    data: { id: ID.teacher, displayName: "田村", tagId: "12" },
  });
  // 全校の休み・行事 (the demo data): 学園祭 11/12-13, 勤労感謝の日 11/23, 防災訓練 12/9.
  await db.closure.createMany({
    data: [
      {
        startDate: textToDateColumn("2026-11-12"),
        endDate: textToDateColumn("2026-11-13"),
        name: "学園祭",
        source: "SYSTEM",
      },
      {
        startDate: textToDateColumn("2026-11-23"),
        name: "勤労感謝の日",
        source: "SYSTEM",
      },
      {
        startDate: textToDateColumn("2026-12-09"),
        name: "防災訓練",
        source: "SYSTEM",
      },
    ],
  });
}
