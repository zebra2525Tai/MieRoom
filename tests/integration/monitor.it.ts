import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { textToDateColumn } from "@/lib/domain/school-date";
import { closeDatabase, resetDatabase, testDb } from "./support/db";
import { ID, USERS, seedBase } from "./support/fixtures";

// T-MON: モニター (S30) と モニターURL (S27) を、本物の PostgreSQL で。合言葉の一意・変更・無効、
// 教室ごとの状態 (授業・予約・使用止め)、年度の外のクラスと休講を出さないこと。
// 「いま」は 2026-11-13(金) 10:30 (1限の後半) と 10:50 (休み時間)。

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/db", async () => {
  const { testDb } = await import("./support/db");
  return { getDb: () => testDb() };
});

import { GET as dataRoute } from "@/app/api/monitor/[passphrase]/route";
import {
  addMonitor,
  findActiveMonitor,
  listMonitors,
  loadMonitorScreen,
  rotateMonitor,
  setMonitorActive,
} from "@/lib/server/monitor";

const IN_LESSON = new Date("2026-11-13T10:30:00+09:00");
const IN_BREAK = new Date("2026-11-13T10:50:00+09:00");
const AFTER = new Date("2026-11-13T17:00:00+09:00");
const DAY = "2026-11-13";

const ROOM_601 = "00000000-0000-4000-8000-000000000601";
const CLASS_OLD = "00000000-0000-4000-8000-000000000011";

beforeEach(async () => {
  await resetDatabase();
  await seedBase();
});

afterAll(async () => {
  await closeDatabase();
});

async function lessonIn(
  roomId: string,
  roomName: string,
  startMinutes: number,
  extra: { cancelled?: boolean; classId?: string; teacher?: string } = {},
) {
  const db = testDb();
  const lesson = await db.lesson.create({
    data: {
      classId: extra.classId ?? ID.classA,
      date: textToDateColumn(DAY),
      startMinutes,
      endMinutes: startMinutes + 90,
      subjectName: "プログラミング",
      roomId,
      roomName,
      kind: "FIXED",
      cancelled: extra.cancelled ?? false,
    },
  });
  if (extra.teacher !== undefined) {
    await db.lessonTeacher.create({
      data: { lessonId: lesson.id, teacherName: extra.teacher },
    });
  }
  return lesson;
}

describe("合言葉 (E18)", () => {
  it("T-MON-001 追加すると 32 文字の合言葉ができ、その合言葉で見つかる", async () => {
    expect(await addMonitor("玄関")).toEqual({ kind: "done", notice: "MI501" });
    const [row] = await listMonitors();
    expect(row.name).toBe("玄関");
    expect(row.passphrase).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(await findActiveMonitor(row.passphrase)).toEqual({
      id: row.id,
      name: "玄関",
    });
  });

  it("T-MON-002 合言葉を変えると、古い合言葉はすぐに使えない", async () => {
    await addMonitor("玄関");
    const [before] = await listMonitors();
    expect(await rotateMonitor(before.id)).toEqual({
      kind: "done",
      notice: "MI501",
    });
    const [after] = await listMonitors();
    expect(after.passphrase).not.toBe(before.passphrase);
    expect(await findActiveMonitor(before.passphrase)).toBeNull();
    expect(await findActiveMonitor(after.passphrase)).not.toBeNull();
  });

  it("T-MON-003 無効にすると見つからず、有効に戻すと見つかる", async () => {
    await addMonitor("玄関");
    const [row] = await listMonitors();
    expect(await setMonitorActive(row.id, false)).toEqual({
      kind: "done",
      notice: "MI502",
    });
    expect(await findActiveMonitor(row.passphrase)).toBeNull();
    expect(await setMonitorActive(row.id, true)).toEqual({
      kind: "done",
      notice: "MI502on",
    });
    expect(await findActiveMonitor(row.passphrase)).not.toBeNull();
  });

  it("T-MON-004 同じ合言葉は、データベースが断る (一意)", async () => {
    await addMonitor("玄関");
    const [row] = await listMonitors();
    await expect(
      testDb().monitor.create({
        data: { name: "別", passphrase: row.passphrase },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("T-MON-005 ないモニターの変更は not_found", async () => {
    const none = "00000000-0000-4000-8000-0000000000ff";
    expect(await rotateMonitor(none)).toEqual({ kind: "not_found" });
    expect(await setMonitorActive(none, false)).toEqual({ kind: "not_found" });
  });
});

describe("入り口 (/api/monitor/<合言葉>)", () => {
  const call = (passphrase: string) =>
    dataRoute(
      new Request(`https://mieroom.example/api/monitor/${passphrase}`),
      {
        params: Promise.resolve({ passphrase }),
      },
    );

  it("T-MON-010 合っていれば 200、違う・無効・形が違うものは 404 (中身なし)", async () => {
    await addMonitor("玄関");
    const [row] = await listMonitors();
    expect((await call(row.passphrase)).status).toBe(200);
    expect((await call("A".repeat(32))).status).toBe(404);
    expect((await call("short")).status).toBe(404);
    await setMonitorActive(row.id, false);
    const disabled = await call(row.passphrase);
    expect(disabled.status).toBe(404);
    expect(await disabled.text()).toBe("");
  });
});

describe("教室ごとの状態 (R4-1, R6-5)", () => {
  it("T-MON-020 授業中: いまの時限の授業を、クラス・教科・先生で出す", async () => {
    await lessonIn(ID.roomHome, "101", 555, { teacher: "岸本" });
    const screen = await loadMonitorScreen(IN_LESSON);
    expect(screen.chips.primary.tone).toBe("lesson");
    expect(screen.states["101"]).toEqual({
      kind: "lesson",
      next: false,
      className: "システム専攻1年",
      subject: "プログラミング",
      teacher: "岸本",
    });
  });

  it("T-MON-021 休み時間: 次の時限の授業を「次」で出す。いまの時限の授業は出さない", async () => {
    await lessonIn(ID.roomHome, "101", 555); // 1限 (終わった)
    const db = testDb();
    await db.room.create({
      data: { id: ROOM_601, name: "601", kind: "FREE" },
    });
    await lessonIn(ROOM_601, "601", 660, { teacher: "田村" }); // 2限
    const screen = await loadMonitorScreen(IN_BREAK);
    expect(screen.chips.primary.text).toBe("休み時間");
    expect(screen.states["101"]).toEqual({ kind: "free" });
    expect(screen.states["601"]).toMatchObject({
      kind: "lesson",
      next: true,
      teacher: "田村",
    });
  });

  it("T-MON-022 休講と、今年度に存在しないクラスの授業は出さない。先生がいなければ各担当", async () => {
    const db = testDb();
    await db.schoolClass.create({
      data: {
        id: CLASS_OLD,
        name: "旧クラス",
        homeRoomId: ID.roomFree,
        startYear: 2020,
        endYear: 2025,
      },
    });
    await lessonIn(ID.roomHome, "101", 555, { cancelled: true });
    expect((await loadMonitorScreen(IN_LESSON)).states["101"]).toEqual({
      kind: "free",
    });
    await lessonIn(ID.roomFree, "展示室", 555, { classId: CLASS_OLD });
    const screen = await loadMonitorScreen(IN_LESSON);
    // 図にない教室 (展示室) は、そもそも出ない
    expect(screen.states["展示室"]).toBeUndefined();
    // 休講でない授業を足すと、先生の行がないので各担当
    await db.lesson.deleteMany({ where: { roomName: "101" } });
    await lessonIn(ID.roomHome, "101", 555);
    expect(
      (
        (await loadMonitorScreen(IN_LESSON)).states["101"] as {
          teacher: string;
        }
      ).teacher,
    ).toBe("各担当");
  });

  it("T-MON-023 使用止め > 授業、承認済みの予約 = 予約使用中、承認待ちは空き", async () => {
    const db = testDb();
    await db.room.createMany({
      data: [
        { id: ROOM_601, name: "601", kind: "FREE" },
        {
          id: "00000000-0000-4000-8000-000000000602",
          name: "602",
          kind: "FREE",
        },
        {
          id: "00000000-0000-4000-8000-000000000603",
          name: "603",
          kind: "FREE",
        },
      ],
    });
    // 101: 授業 + 使用止め (1限) → 使用止め
    await lessonIn(ID.roomHome, "101", 555);
    await db.roomBlock.create({
      data: {
        roomId: ID.roomHome,
        startDate: textToDateColumn(DAY),
        startPeriod: 1,
        endDate: textToDateColumn(DAY),
        endPeriod: 1,
        setByName: "先生 花子",
      },
    });
    // 601: 承認済みの予約 (枠 2 = 1限後半) → 予約使用中
    await db.reservation.create({
      data: {
        roomId: ROOM_601,
        date: textToDateColumn(DAY),
        purpose: "自習",
        status: "APPROVED",
        applicantId: USERS.student.id,
        applicantName: USERS.student.name,
        slots: { create: [{ slot: 2 }] },
      },
    });
    // 602: 承認待ちの予約 → 空き
    await db.reservation.create({
      data: {
        roomId: "00000000-0000-4000-8000-000000000602",
        date: textToDateColumn(DAY),
        purpose: "自習",
        status: "PENDING",
        applicantId: USERS.student.id,
        applicantName: USERS.student.name,
        slots: { create: [{ slot: 2 }] },
      },
    });
    const screen = await loadMonitorScreen(IN_LESSON);
    expect(screen.states["101"]).toEqual({ kind: "blocked" });
    expect(screen.states["601"]).toEqual({ kind: "reserved" });
    expect(screen.states["602"]).toEqual({ kind: "free" });
    expect(screen.states["603"]).toEqual({ kind: "free" });
  });

  it("T-MON-024 4限のあとは、全部空き (授業は出さない)", async () => {
    await lessonIn(ID.roomHome, "101", 555);
    const screen = await loadMonitorScreen(AFTER);
    expect(screen.chips.primary.tone).toBe("ended");
    expect(screen.states["101"]).toEqual({ kind: "free" });
  });

  it("T-MON-025 画面のデータに、予約の用途・申請者の名前は入らない", async () => {
    const db = testDb();
    await db.room.create({ data: { id: ROOM_601, name: "601", kind: "FREE" } });
    await db.reservation.create({
      data: {
        roomId: ROOM_601,
        date: textToDateColumn(DAY),
        purpose: "就活",
        note: "秘密のメモ",
        status: "APPROVED",
        applicantId: USERS.student.id,
        applicantName: USERS.student.name,
        slots: { create: [{ slot: 2 }] },
      },
    });
    const text = JSON.stringify(await loadMonitorScreen(IN_LESSON));
    expect(text).not.toContain("就活");
    expect(text).not.toContain("秘密のメモ");
    expect(text).not.toContain(USERS.student.name);
  });
});
