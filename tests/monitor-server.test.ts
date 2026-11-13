import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOGIN_ERROR_MESSAGES, MESSAGES } from "@/lib/messages";

// S30 モニター / S27 モニターURL のサーバー側: 合言葉の確認、画面に出すデータ、管理の入り口。

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
  monitor: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  room: { findMany: vi.fn() },
  lesson: { findMany: vi.fn() },
}));
vi.mock("@/lib/server/db", () => ({ getDb: () => db }));
const overlays = vi.hoisted(() => ({ loadDayOverlays: vi.fn() }));
vi.mock("@/lib/server/queries/reservations", () => ({
  loadDayOverlays: overlays.loadDayOverlays,
}));
const session = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/server/session", () => ({
  getCurrentUser: session.getCurrentUser,
  hasRole: (user: { role: string }, role: string) =>
    role === "admin"
      ? user.role === "admin"
      : role === "teacher"
        ? user.role !== "student"
        : true,
}));

import { POST as activeRoute } from "@/app/(main)/admin/monitors/active/route";
import { POST as addRoute } from "@/app/(main)/admin/monitors/add/route";
import { POST as rotateRoute } from "@/app/(main)/admin/monitors/rotate/route";
import { GET as dataRoute } from "@/app/api/monitor/[passphrase]/route";
import {
  addMonitor,
  createPassphrase,
  findActiveMonitor,
  loadMonitorScreen,
  rotateMonitor,
  setMonitorActive,
} from "@/lib/server/monitor";

const GOOD = "A".repeat(32);
const ID = "5b0f2f3a-8a4e-4a39-8a5c-1e6a0a1d3b11";
const ROOM_A = "00000000-0000-4000-8000-0000000000a1";
const ROOM_B = "00000000-0000-4000-8000-0000000000b2";
const ROOM_C = "00000000-0000-4000-8000-0000000000c3";

describe("合言葉を作る", () => {
  it("24バイトの乱数で、32文字。毎回違う", () => {
    const a = createPassphrase();
    const b = createPassphrase();
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(a).not.toBe(b);
  });
});

describe("findActiveMonitor (S91 の元)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("形が違う合言葉は、DB に問い合わせずに null", async () => {
    for (const value of ["", "abc", "x".repeat(31), `${GOOD}/`, null, 5]) {
      expect(await findActiveMonitor(value), String(value)).toBeNull();
    }
    expect(db.monitor.findFirst).not.toHaveBeenCalled();
  });

  it("有効な合言葉だけを探す。見つからなければ null", async () => {
    db.monitor.findFirst.mockResolvedValue(null);
    expect(await findActiveMonitor(GOOD)).toBeNull();
    expect(db.monitor.findFirst).toHaveBeenCalledWith({
      where: { passphrase: GOOD, active: true },
      select: { id: true, name: true },
    });
    db.monitor.findFirst.mockResolvedValue({ id: ID, name: "玄関" });
    expect(await findActiveMonitor(GOOD)).toEqual({ id: ID, name: "玄関" });
  });
});

describe("S27 追加・合言葉を変える・無効にする", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.monitor.create.mockResolvedValue({});
    db.monitor.updateMany.mockResolvedValue({ count: 1 });
  });

  it("追加: 名前の前後の空白を除き、合言葉を作って保存する", async () => {
    expect(await addMonitor("  1階の玄関 ")).toEqual({
      kind: "done",
      notice: "MI501",
    });
    const data = db.monitor.create.mock.calls[0][0].data;
    expect(data.name).toBe("1階の玄関");
    expect(data.passphrase).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("追加: 名前は必須 (ME501)、20文字まで (ME504)。何も保存しない", async () => {
    expect(await addMonitor("   ")).toEqual({
      kind: "invalid",
      message: MESSAGES.ME501,
    });
    expect(await addMonitor("あ".repeat(21))).toEqual({
      kind: "invalid",
      message: MESSAGES.ME504(20),
    });
    expect(await addMonitor("あ".repeat(20))).toMatchObject({ kind: "done" });
    expect(await addMonitor(123)).toEqual({ kind: "not_found" });
    expect(db.monitor.create).toHaveBeenCalledTimes(1);
  });

  it("追加: 合言葉が重なったら、作り直す", async () => {
    db.monitor.create
      .mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" }))
      .mockResolvedValueOnce({});
    expect(await addMonitor("玄関")).toMatchObject({ kind: "done" });
    expect(db.monitor.create).toHaveBeenCalledTimes(2);
    const first = db.monitor.create.mock.calls[0][0].data.passphrase;
    const second = db.monitor.create.mock.calls[1][0].data.passphrase;
    expect(first).not.toBe(second);
  });

  it("合言葉を変える: 新しい合言葉に書き換える。行がなければ not_found", async () => {
    expect(await rotateMonitor(ID)).toEqual({ kind: "done", notice: "MI501" });
    const call = db.monitor.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: ID });
    expect(call.data.passphrase).toMatch(/^[A-Za-z0-9_-]{32}$/);
    db.monitor.updateMany.mockResolvedValue({ count: 0 });
    expect(await rotateMonitor(ID)).toEqual({ kind: "not_found" });
    db.monitor.updateMany.mockClear();
    expect(await rotateMonitor("x' OR 1=1")).toEqual({ kind: "not_found" });
    expect(db.monitor.updateMany).not.toHaveBeenCalled();
  });

  it("無効にする・有効に戻す: 答えが違い、形が違うものは書かない", async () => {
    expect(await setMonitorActive(ID, false)).toEqual({
      kind: "done",
      notice: "MI502",
    });
    expect(await setMonitorActive(ID, true)).toEqual({
      kind: "done",
      notice: "MI502on",
    });
    db.monitor.updateMany.mockClear();
    expect(await setMonitorActive(ID, "no")).toEqual({ kind: "not_found" });
    expect(await setMonitorActive("bad", true)).toEqual({ kind: "not_found" });
    expect(db.monitor.updateMany).not.toHaveBeenCalled();
  });
});

describe("loadMonitorScreen: 図の教室ごとの状態 (R4-1, R6-5)", () => {
  // 2026-11-13(金) 10:30 JST = 1限の後半 (枠 2)。10:50 JST は休み時間 (次は 2限)。
  const IN_LESSON = new Date("2026-11-13T01:30:00Z");
  const IN_BREAK = new Date("2026-11-13T01:50:00Z");
  const AFTER = new Date("2026-11-13T08:00:00Z"); // 17:00 JST

  const lesson = (
    roomId: string,
    className: string,
    subject: string,
    teachers: string[],
  ) => ({
    roomId,
    subjectName: subject,
    class: { name: className },
    teachers: teachers.map((teacherName) => ({ teacherName })),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    db.room.findMany.mockResolvedValue([
      { id: ROOM_A, name: "201" },
      { id: ROOM_B, name: "202" },
      { id: ROOM_C, name: "203" },
    ]);
    db.lesson.findMany.mockResolvedValue([]);
    overlays.loadDayOverlays.mockResolvedValue({
      reservations: new Map(),
      blockedPeriods: new Map(),
    });
  });

  it("授業中: いまの時限の授業は、クラス名・教科・先生。何もなければ空き", async () => {
    db.lesson.findMany.mockResolvedValue([
      lesson(ROOM_A, "大学併修1年", "プログラミング", ["岸本"]),
    ]);
    const screen = await loadMonitorScreen(IN_LESSON);
    expect(screen.chips.primary.tone).toBe("lesson");
    expect(screen.states).toEqual({
      "201": {
        kind: "lesson",
        next: false,
        className: "大学併修1年",
        subject: "プログラミング",
        teacher: "岸本",
      },
      "202": { kind: "free" },
      "203": { kind: "free" },
    });
    expect(screen.updatedAt).toBe(IN_LESSON.toISOString());
  });

  it("授業は、今日・その時限の開始・休講でない・今年度の有効なクラスだけを読む", async () => {
    await loadMonitorScreen(IN_LESSON);
    const where = db.lesson.findMany.mock.calls[0][0].where;
    expect(where.date.toISOString().slice(0, 10)).toBe("2026-11-13");
    expect(where.startMinutes).toBe(9 * 60 + 15); // 1限
    expect(where.cancelled).toBe(false);
    expect(where.class).toMatchObject({
      active: true,
      startYear: { lte: 2026 },
    });
    expect(where.roomId.in).toEqual([ROOM_A, ROOM_B, ROOM_C]);
  });

  it("休み時間: 次の時限 (2限) の授業を「次」で出す", async () => {
    db.lesson.findMany.mockResolvedValue([
      lesson(ROOM_B, "医療情報1年", "情報基礎", ["三和田"]),
    ]);
    const screen = await loadMonitorScreen(IN_BREAK);
    expect(screen.chips.primary).toEqual({ tone: "break", text: "休み時間" });
    expect(screen.states["202"]).toMatchObject({ kind: "lesson", next: true });
    expect(db.lesson.findMany.mock.calls[0][0].where.startMinutes).toBe(
      11 * 60,
    );
  });

  it("合同の授業 (同じ教室に複数のクラス) は、名前をまとめる。講師がいなければ各担当", async () => {
    db.lesson.findMany.mockResolvedValue([
      lesson(ROOM_A, "医療情報2年", "英語", []),
      lesson(ROOM_A, "大学併修2年", "英語", []),
    ]);
    const screen = await loadMonitorScreen(IN_LESSON);
    expect(screen.states["201"]).toMatchObject({
      kind: "lesson",
      subject: "英語",
      teacher: "各担当",
    });
    const joined = (screen.states["201"] as { className: string }).className;
    expect(joined.split("・").sort()).toEqual(["医療情報2年", "大学併修2年"]);
  });

  it("使用止め > 授業 > 予約済み。承認待ち (仮予約) は空き", async () => {
    db.lesson.findMany.mockResolvedValue([
      lesson(ROOM_A, "大学併修1年", "数学", ["岸本"]),
      lesson(ROOM_B, "医療情報1年", "国語", ["中村"]),
    ]);
    overlays.loadDayOverlays.mockResolvedValue({
      // ROOM_A: 使用止め (授業より強い)。ROOM_B: 授業と予約 (授業を出す)。
      // ROOM_C: 承認済みの予約 (枠 2) → 予約使用中
      reservations: new Map([
        [ROOM_B, [{ status: "approved", date: "2026-11-13", slots: [2] }]],
        [ROOM_C, [{ status: "approved", date: "2026-11-13", slots: [2] }]],
      ]),
      blockedPeriods: new Map([[ROOM_A, new Set([1])]]),
    });
    const screen = await loadMonitorScreen(IN_LESSON);
    expect(screen.states["201"]).toEqual({ kind: "blocked" });
    expect(screen.states["202"]).toMatchObject({ kind: "lesson" });
    expect(screen.states["203"]).toEqual({ kind: "reserved" });

    overlays.loadDayOverlays.mockResolvedValue({
      reservations: new Map([
        [ROOM_C, [{ status: "pending", date: "2026-11-13", slots: [2] }]],
      ]),
      blockedPeriods: new Map(),
    });
    const pending = await loadMonitorScreen(IN_LESSON);
    expect(pending.states["203"]).toEqual({ kind: "free" });
  });

  it("予約は、いまの枠 (前半・後半) で見る", async () => {
    overlays.loadDayOverlays.mockResolvedValue({
      reservations: new Map([
        [ROOM_C, [{ status: "approved", date: "2026-11-13", slots: [1] }]],
      ]),
      blockedPeriods: new Map(),
    });
    // 10:30 は 1限後半 (枠 2): 前半 (枠 1) だけの予約は出ない
    expect((await loadMonitorScreen(IN_LESSON)).states["203"]).toEqual({
      kind: "free",
    });
    // 9:30 は 1限前半 (枠 1)
    const early = await loadMonitorScreen(new Date("2026-11-13T00:30:00Z"));
    expect(early.states["203"]).toEqual({ kind: "reserved" });
  });

  it("4限が終わったあとは、授業を読まず、全部空き", async () => {
    const screen = await loadMonitorScreen(AFTER);
    expect(screen.chips.primary.tone).toBe("ended");
    expect(screen.states).toEqual({
      "201": { kind: "free" },
      "202": { kind: "free" },
      "203": { kind: "free" },
    });
    expect(db.lesson.findMany).not.toHaveBeenCalled();
  });

  it("読むのは、図にある教室の名前だけ。個人の情報 (予約の用途・申請者) は選ばない", async () => {
    await loadMonitorScreen(IN_LESSON);
    const roomQuery = db.room.findMany.mock.calls[0][0];
    expect(roomQuery.where.active).toBe(true);
    expect(roomQuery.where.name.in).toContain("101");
    expect(roomQuery.select).toEqual({ id: true, name: true });
    const lessonSelect = db.lesson.findMany.mock.calls[0][0].select;
    expect(JSON.stringify(lessonSelect)).not.toMatch(/email|applicant|purpose/);
  });
});

describe("S30 の入り口 (/api/monitor/<合言葉>)", () => {
  const call = (passphrase: string) =>
    dataRoute(
      new Request(`https://mieroom.example/api/monitor/${passphrase}`),
      {
        params: Promise.resolve({ passphrase }),
      },
    );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.room.findMany.mockResolvedValue([]);
    db.lesson.findMany.mockResolvedValue([]);
    overlays.loadDayOverlays.mockResolvedValue({
      reservations: new Map(),
      blockedPeriods: new Map(),
    });
  });

  it("違う・無効な合言葉は、何も返さず 404。DB の部屋・授業は読まない", async () => {
    db.monitor.findFirst.mockResolvedValue(null);
    const response = await call(GOOD);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(db.room.findMany).not.toHaveBeenCalled();
    expect(db.lesson.findMany).not.toHaveBeenCalled();
    // 形が違うものは、DB にも問い合わせない
    db.monitor.findFirst.mockClear();
    expect((await call("short")).status).toBe(404);
    expect(db.monitor.findFirst).not.toHaveBeenCalled();
  });

  it("合っていれば、教室の状態を返す。キャッシュさせず、検索に載せない", async () => {
    db.monitor.findFirst.mockResolvedValue({ id: ID, name: "玄関" });
    const response = await call(GOOD);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toMatch(/noindex/);
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(["chips", "states", "updatedAt"]);
  });

  it("DB の失敗は、内部の情報を出さず 500", async () => {
    db.monitor.findFirst.mockRejectedValue(new Error("prisma: connection"));
    const response = await call(GOOD);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toMatch(/prisma|connection|stack/i);
  });
});

describe("S27 の入り口 (時間割管理者だけ)", () => {
  const HOST = "mieroom.example";
  const SAME = { "sec-fetch-site": "same-origin", host: HOST };
  const post = (
    path: string,
    body: unknown,
    headers: Record<string, string> = SAME,
  ) =>
    new NextRequest(`https://${HOST}${path}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", ...headers },
    });
  const as = (role: "student" | "teacher" | "admin" | null) =>
    session.getCurrentUser.mockResolvedValue(
      role === null ? null : { id: "u1", name: "管理者", role },
    );

  const ROUTES = [
    ["/admin/monitors/add", addRoute, { name: "玄関" }],
    ["/admin/monitors/rotate", rotateRoute, { id: ID }],
    ["/admin/monitors/active", activeRoute, { id: ID, active: false }],
  ] as const;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    as("admin");
    db.monitor.create.mockResolvedValue({});
    db.monitor.updateMany.mockResolvedValue({ count: 1 });
  });

  describe.each(ROUTES)("%s", (path, route, body) => {
    it("先生・学生は 403 (ME004)、ログインなしは 401 (ME005)。何も書かない", async () => {
      for (const role of ["student", "teacher"] as const) {
        as(role);
        const response = await route(post(path, body));
        expect(response.status, role).toBe(403);
        expect(await response.json()).toEqual({ message: MESSAGES.ME004 });
      }
      as(null);
      const none = await route(post(path, body));
      expect(none.status).toBe(401);
      expect(await none.json()).toEqual({
        message: LOGIN_ERROR_MESSAGES.ME005,
      });
      expect(db.monitor.create).not.toHaveBeenCalled();
      expect(db.monitor.updateMany).not.toHaveBeenCalled();
    });

    it("同じサイトの画面からだけ", async () => {
      for (const headers of [
        { "sec-fetch-site": "cross-site", host: HOST },
        { host: HOST },
        { origin: "https://evil.example", host: HOST },
      ] as Record<string, string>[]) {
        const response = await route(post(path, body, headers));
        expect(response.status).toBe(403);
      }
      expect(db.monitor.create).not.toHaveBeenCalled();
      expect(db.monitor.updateMany).not.toHaveBeenCalled();
    });

    it("時間割管理者なら通る (答えは短い文)", async () => {
      const response = await route(post(path, body));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        notice: expect.stringMatching(/^MI50/),
      });
    });
  });

  it("追加の名前が空なら 400 (ME501)。保存しない", async () => {
    const response = await addRoute(post("/admin/monitors/add", { name: "" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: MESSAGES.ME501 });
    expect(db.monitor.create).not.toHaveBeenCalled();
  });

  it("存在しない id は 404 (ME902)。DB の失敗は、内部の情報を出さず 500", async () => {
    db.monitor.updateMany.mockResolvedValue({ count: 0 });
    const gone = await rotateRoute(post("/admin/monitors/rotate", { id: ID }));
    expect(gone.status).toBe(404);
    expect(await gone.json()).toEqual({ message: MESSAGES.ME902 });
    db.monitor.updateMany.mockRejectedValue(new Error("prisma exploded"));
    const failed = await rotateRoute(
      post("/admin/monitors/rotate", { id: ID }),
    );
    expect(failed.status).toBe(500);
    expect(JSON.stringify(await failed.json())).not.toMatch(/prisma|exploded/);
  });
});
