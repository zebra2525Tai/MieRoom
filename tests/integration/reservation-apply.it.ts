import { NextRequest } from "next/server";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { textToDateColumn } from "@/lib/domain/school-date";
import { LOGIN_ERROR_MESSAGES, MESSAGES } from "@/lib/messages";
import { testDb, closeDatabase, resetDatabase } from "./support/db";
import {
  ID,
  PERIOD,
  ROOM_FREE_NAME,
  USERS,
  seedBase,
  type TestRole,
} from "./support/fixtures";

// T-RSV (申請) と T-APR-006/008 (取り下げ): the route, the server function and a real database
// (テスト設計書 4-2, 4-3). The clock is fixed to Japan time: 2026-11-10 (火) 10:00 unless a case
// says otherwise. Slots: 1=1限前半, 2=1限後半, 3=2限前半, 4=2限後半, 5=3限前半 ...

vi.mock("server-only", () => ({}));
const session = vi.hoisted(() => ({
  user: null as null | { id: string; name: string; role: TestRole },
}));
vi.mock("@/lib/server/session", async () => {
  const { hasRole } = await import("./support/session");
  return { getCurrentUser: async () => session.user, hasRole };
});
vi.mock("@/lib/server/db", async () => {
  const { testDb } = await import("./support/db");
  return { getDb: () => testDb() };
});

import { POST as apply } from "@/app/(main)/reservations/apply/route";
import { POST as withdraw } from "@/app/(main)/reservations/withdraw/route";

const HOST = "mieroom.example";

/** Japan time "2026-11-10T10:00" as the clock of the server. */
const at = (jst: string) => vi.setSystemTime(new Date(`${jst}:00+09:00`));

function post(path: string, body: unknown) {
  return new NextRequest(`https://${HOST}${path}`, {
    method: "POST",
    headers: {
      host: HOST,
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

type Input = {
  roomId?: string;
  date: string;
  slots: number[];
  purpose?: string;
  note?: string;
};

const book = (input: Input) =>
  apply(
    post("/reservations/apply", {
      roomId: ID.roomFree,
      purpose: "自習",
      note: "",
      ...input,
    }),
  );

/** The ME codes an application is refused with (the answer is 400 {issues}). */
async function codes(response: Response): Promise<string[]> {
  expect(response.status).toBe(400);
  const body = (await response.json()) as { issues: { code: string }[] };
  return body.issues.map((issue) => issue.code);
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  at("2026-11-10T10:00");
  await resetDatabase();
  await seedBase();
  session.user = USERS.student;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await closeDatabase();
});

describe("申請(R4-2〜R4-5)", () => {
  it("T-RSV-001 正常: MI101。承認待ちで、申請者の氏名が残る", async () => {
    const response = await book({ date: "2026-11-16", slots: [1, 2] });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ notice: "MI101" });
    const rows = await testDb().reservation.findMany({
      include: { slots: true },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: "PENDING",
      proxy: false,
      applicantId: USERS.student.id,
      applicantName: USERS.student.name,
      roomId: ID.roomFree,
    });
    expect(rows[0].slots.map((slot) => slot.slot).sort()).toEqual([1, 2]);
  });

  it("T-RSV-002/003 締め切りの境界: 11/16(月)の枠は、11/11(水)12:00 まで(11/12・13 は学園祭)", async () => {
    at("2026-11-11T11:59");
    expect((await book({ date: "2026-11-16", slots: [1] })).status).toBe(200);
    at("2026-11-11T12:00");
    expect(await codes(await book({ date: "2026-11-16", slots: [3] }))).toEqual(
      ["ME101"],
    );
  });

  it("T-RSV-004 休みをまたぐ締め切り: 11/24(火)の枠は、11/20(金)12:00 まで", async () => {
    at("2026-11-20T11:59");
    expect((await book({ date: "2026-11-24", slots: [1] })).status).toBe(200);
    at("2026-11-20T12:00");
    expect(await codes(await book({ date: "2026-11-24", slots: [3] }))).toEqual(
      ["ME101"],
    );
  });

  it("T-RSV-005 当日の枠は申請できない(ME101)", async () => {
    expect(await codes(await book({ date: "2026-11-10", slots: [5] }))).toEqual(
      ["ME101"],
    );
  });

  it("T-RSV-006 過ぎた日は ME103", async () => {
    expect(await codes(await book({ date: "2026-11-09", slots: [5] }))).toEqual(
      ["ME103"],
    );
  });

  it("T-RSV-007 30日先の境界: 12/10(木)は可、12/11(金)は ME102", async () => {
    expect((await book({ date: "2026-12-10", slots: [1] })).status).toBe(200);
    expect(await codes(await book({ date: "2026-12-11", slots: [1] }))).toEqual(
      ["ME102"],
    );
  });

  it("T-RSV-008 昼休みをまたぐ続いた枠(2限後半+3限前半)は可", async () => {
    expect((await book({ date: "2026-11-16", slots: [4, 5] })).status).toBe(
      200,
    );
  });

  it("T-RSV-009/010 間が空く、枠が 0 件は ME104", async () => {
    expect(
      await codes(await book({ date: "2026-11-16", slots: [1, 3] })),
    ).toEqual(["ME104"]);
    expect(await codes(await book({ date: "2026-11-16", slots: [] }))).toEqual([
      "ME104",
    ]);
  });

  it("T-RSV-011 授業がある枠は ME105(授業のない枠は可)", async () => {
    await testDb().lesson.create({
      data: {
        classId: ID.classA,
        date: textToDateColumn("2026-11-17"),
        startMinutes: PERIOD.p1.start,
        endMinutes: PERIOD.p1.end,
        subjectName: "プログラミング",
        roomId: ID.roomFree,
        roomName: ROOM_FREE_NAME,
        kind: "FIXED",
      },
    });
    expect(await codes(await book({ date: "2026-11-17", slots: [1] }))).toEqual(
      ["ME105"],
    );
    expect((await book({ date: "2026-11-17", slots: [3] })).status).toBe(200);
  });

  it("T-RSV-012 使用止めの時限を一部でも含めば ME106", async () => {
    await testDb().roomBlock.create({
      data: {
        roomId: ID.roomFree,
        startDate: textToDateColumn("2026-11-17"),
        startPeriod: 1,
        endDate: textToDateColumn("2026-11-17"),
        endPeriod: 1,
        setById: USERS.teacher.id,
        setByName: USERS.teacher.name,
      },
    });
    expect(
      await codes(await book({ date: "2026-11-17", slots: [2, 3] })),
    ).toEqual(["ME106"]);
  });

  it("T-RSV-013 用途が空は ME107", async () => {
    expect(
      await codes(await book({ date: "2026-11-16", slots: [1], purpose: "" })),
    ).toEqual(["ME107"]);
  });

  it("T-RSV-014 備考は 100 文字まで(101 文字は ME108)", async () => {
    expect(
      (await book({ date: "2026-11-16", slots: [1], note: "あ".repeat(100) }))
        .status,
    ).toBe(200);
    expect(
      await codes(
        await book({ date: "2026-11-16", slots: [3], note: "あ".repeat(101) }),
      ),
    ).toEqual(["ME108"]);
  });

  it("T-RSV-015 無効な教室は ME109", async () => {
    await testDb().room.update({
      where: { id: ID.roomFree },
      data: { active: false },
    });
    expect(await codes(await book({ date: "2026-11-16", slots: [1] }))).toEqual(
      ["ME109"],
    );
  });

  it("T-RSV-016/017 同じ枠に、ほかの承認待ちがあっても申請できる(警告は画面で)", async () => {
    expect((await book({ date: "2026-11-16", slots: [1] })).status).toBe(200);
    session.user = USERS.otherStudent;
    expect((await book({ date: "2026-11-16", slots: [1] })).status).toBe(200);
    expect(await testDb().reservation.count()).toBe(2);
  });

  it("T-RSV 形が違う本文は、何も保存せず 400", async () => {
    const response = await apply(post("/reservations/apply", { date: 1 }));
    expect(response.status).toBe(400);
    expect(await testDb().reservation.count()).toBe(0);
  });
});

describe("取り下げ(R4-6)", () => {
  async function pending(applicant = USERS.student) {
    session.user = applicant;
    const response = await book({ date: "2026-11-16", slots: [1] });
    return ((await response.json()) as { id: string }).id;
  }

  it("T-APR-006 申請者は、承認待ちを取り下げられる(MI102)", async () => {
    const id = await pending();
    const response = await withdraw(post("/reservations/withdraw", { id }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ notice: "MI102" });
    expect(
      (await testDb().reservation.findUniqueOrThrow({ where: { id } })).status,
    ).toBe("WITHDRAWN");
  });

  it("T-APR-007 取り下げ済み・対応済みは取り下げられない(ME110)", async () => {
    const id = await pending();
    await testDb().reservation.update({
      where: { id },
      data: { status: "APPROVED" },
    });
    const response = await withdraw(post("/reservations/withdraw", { id }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: MESSAGES.ME110 });
  });

  it("T-APR-008 他人の予約は取り下げられず、元の予約は変わらない", async () => {
    const id = await pending(USERS.student);
    session.user = USERS.otherStudent;
    const response = await withdraw(post("/reservations/withdraw", { id }));
    expect(response.status).toBe(404);
    expect(
      (await testDb().reservation.findUniqueOrThrow({ where: { id } })).status,
    ).toBe("PENDING");
  });

  it("T-APR-006x 最初の枠が始まったあとは、取り下げられない(ME110)", async () => {
    const id = await pending();
    at("2026-11-16T09:15"); // the first slot starts
    const response = await withdraw(post("/reservations/withdraw", { id }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: MESSAGES.ME110 });
  });

  it("T-AUTH 未ログインは 401(ME005)", async () => {
    session.user = null;
    const response = await withdraw(
      post("/reservations/withdraw", { id: "x" }),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      message: LOGIN_ERROR_MESSAGES.ME005,
    });
  });
});
