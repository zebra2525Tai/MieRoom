import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseClass,
  parseRoom,
  parseSubject,
  parseTeacher,
} from "@/lib/domain/master-edit";
import { LOGIN_ERROR_MESSAGES, MESSAGES } from "@/lib/messages";

// S21 マスタ: the rules for the input, the saving, and the entry points.

vi.mock("server-only", () => ({}));
const tx = vi.hoisted(() => ({
  schoolClass: { findUnique: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  subject: { findUnique: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  room: { findUnique: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  teacher: { findUnique: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  lesson: { updateMany: vi.fn() },
  lessonTeacher: { updateMany: vi.fn() },
}));
const db = vi.hoisted(() => ({
  schoolClass: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  subject: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  room: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  teacher: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/server/db", () => ({ getDb: () => db }));
vi.mock("@/lib/server/queries/export", () => ({
  loadExportSource: vi.fn().mockRejectedValue(new Error("not needed here")),
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

import { POST as activeRoute } from "@/app/(main)/admin/masters/active/route";
import { POST as saveRoute } from "@/app/(main)/admin/masters/save/route";
import { saveMaster, setMasterActive } from "@/lib/server/master-edit";

const ID = "5b0f2f3a-8a4e-4a39-8a5c-1e6a0a1d3b11";
const ROOM = "9c1d7e22-0d0e-4a7e-9a55-0f7b1d2a8c33";
const NOW = new Date("2026-11-10T00:00:00Z"); // 11/10 (Japan)
const VERSION = "2026-11-01T00:00:00.000Z";
const fields = (
  result: { ok: true } | { ok: false; errors: { field: string }[] },
) => (result.ok ? [] : result.errors.map((e) => e.field));

describe("教室の規則", () => {
  const room = { name: "304", kind: "FREE", building: "", note: "" };
  it("空欄は null にして、前後の空白(半角・全角)を取り、全角数字を半角にする", () => {
    expect(parseRoom({ ...room, name: "　３０４ " })).toEqual({
      ok: true,
      value: { name: "304", building: null, kind: "FREE", note: null },
    });
    // 数字以外の全角は、そのまま(ツールと同じ)
    expect(parseRoom({ ...room, name: "Ａ１０１" })).toMatchObject({
      ok: true,
      value: { name: "Ａ101" },
    });
  });
  it("20文字まで・棟20・備考50(全角も半角も1文字)", () => {
    expect(parseRoom({ ...room, name: "あ".repeat(20) }).ok).toBe(true);
    expect(fields(parseRoom({ ...room, name: "あ".repeat(21) }))).toEqual([
      "name",
    ]);
    expect(fields(parseRoom({ ...room, building: "a".repeat(21) }))).toEqual([
      "building",
    ]);
    expect(parseRoom({ ...room, note: "x".repeat(50) }).ok).toBe(true);
    expect(fields(parseRoom({ ...room, note: "x".repeat(51) }))).toEqual([
      "note",
    ]);
    expect(parseRoom({ ...room, name: "😀".repeat(20) }).ok).toBe(true);
  });
  it("必須・「ー」は不可・分類は2つのどちらか", () => {
    expect(fields(parseRoom({ ...room, name: " " }))).toEqual(["name"]);
    for (const dash of ["ー", "－", "-"]) {
      expect(fields(parseRoom({ ...room, name: dash })), dash).toEqual([
        "name",
      ]);
    }
    expect(parseRoom({ ...room, name: "ー1" }).ok).toBe(true); // 「ー」だけが不可
    expect(fields(parseRoom({ ...room, kind: "OTHER" }))).toEqual(["kind"]);
    expect(fields(parseRoom({ ...room, kind: undefined }))).toEqual(["kind"]);
    expect(fields(parseRoom(null))).toContain("name");
  });
});

describe("講師の規則", () => {
  it("表記とメール。メールは小文字にそろえる。空欄は null", () => {
    expect(
      parseTeacher({ displayName: " 田村 ", email: " Tamura@Example.JP " }),
    ).toEqual({
      ok: true,
      value: { displayName: "田村", email: "tamura@example.jp" },
    });
    expect(parseTeacher({ displayName: "田村", email: "" })).toMatchObject({
      ok: true,
      value: { email: null },
    });
  });
  it("「各担当」「外部講師」「、」は不可。20文字まで。メールの形", () => {
    const messages = (raw: unknown) => {
      const result = parseTeacher(raw);
      return result.ok ? [] : result.errors.map((e) => e.message);
    };
    expect(messages({ displayName: "各担当" })).toEqual([MESSAGES.ME503]);
    expect(messages({ displayName: "外部講師" })).toEqual([MESSAGES.ME503]);
    expect(messages({ displayName: "田村、山田" })).toEqual([MESSAGES.ME515]);
    expect(messages({ displayName: "あ".repeat(21) })).toEqual([
      MESSAGES.ME504(20),
    ]);
    expect(messages({ displayName: "" })).toEqual([MESSAGES.ME501]);
    expect(messages({ displayName: "田村", email: "not-an-email" })).toEqual([
      MESSAGES.ME516,
    ]);
    expect(messages({ displayName: "田村", email: "a@b.c d" })).toEqual([
      MESSAGES.ME516,
    ]);
  });
});

describe("教科の規則", () => {
  it("30文字まで・必須", () => {
    expect(parseSubject({ name: " 英語A " })).toEqual({
      ok: true,
      value: { name: "英語A" },
    });
    expect(fields(parseSubject({ name: "あ".repeat(31) }))).toEqual(["name"]);
    expect(fields(parseSubject({ name: "" }))).toEqual(["name"]);
  });
});

describe("クラスの規則", () => {
  const input = {
    name: "デザイン科1年",
    homeRoomId: ROOM,
    startYear: "2026",
    endYear: "",
  };
  it("年度は4桁。終了年度は空欄(続く)か、開始年度以降", () => {
    expect(parseClass(input)).toEqual({
      ok: true,
      value: {
        name: "デザイン科1年",
        homeRoomId: ROOM,
        startYear: 2026,
        endYear: null,
      },
    });
    expect(parseClass({ ...input, endYear: 2026 }).ok).toBe(true);
    expect(parseClass({ ...input, startYear: "２０２６" }).ok).toBe(true);
    const errors = (raw: unknown) => {
      const result = parseClass(raw);
      return result.ok
        ? []
        : result.errors.map((e) => `${e.field}:${e.message}`);
    };
    expect(errors({ ...input, endYear: "2025" })).toEqual([
      `endYear:${MESSAGES.ME505}`,
    ]);
    expect(errors({ ...input, startYear: "26" })).toEqual([
      `startYear:${MESSAGES.ME517}`,
    ]);
    expect(errors({ ...input, startYear: "" })).toEqual([
      `startYear:${MESSAGES.ME501}`,
    ]);
    expect(errors({ ...input, endYear: "abcd" })).toEqual([
      `endYear:${MESSAGES.ME517}`,
    ]);
    expect(errors({ ...input, homeRoomId: "" })).toEqual([
      `homeRoomId:${MESSAGES.ME501}`,
    ]);
    expect(errors({ ...input, name: "あ".repeat(31) })).toEqual([
      `name:${MESSAGES.ME504(30)}`,
    ]);
  });
});

describe("saveMaster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const table of [db.schoolClass, db.subject, db.room, db.teacher]) {
      table.findFirst.mockResolvedValue(null);
      table.create.mockResolvedValue({});
    }
    db.$transaction.mockImplementation((work: (t: typeof tx) => unknown) =>
      work(tx),
    );
    for (const table of [tx.schoolClass, tx.subject, tx.room, tx.teacher]) {
      table.updateMany.mockResolvedValue({ count: 1 });
      table.count.mockResolvedValue(1);
    }
    tx.room.findUnique.mockResolvedValue({ name: "304" });
    tx.subject.findUnique.mockResolvedValue({ name: "英語A" });
    tx.teacher.findUnique.mockResolvedValue({ displayName: "田村" });
    tx.schoolClass.findUnique.mockResolvedValue({ name: "A組" });
  });

  it("追加できる(教室)。保存の後、MW502 のための数も返す", async () => {
    const result = await saveMaster(
      "rooms",
      { name: "３０５", kind: "FREE" },
      NOW,
    );
    expect(result).toMatchObject({
      kind: "saved",
      notice: "MI501",
      renamed: false,
    });
    expect(db.room.create).toHaveBeenCalledWith({
      data: { name: "305", building: null, kind: "FREE", note: null },
    });
  });

  it("同じ名前は、無効なものを含めて断る(ME502)。自分自身は除く", async () => {
    db.room.findFirst.mockResolvedValue({ id: "x" });
    expect(
      await saveMaster("rooms", { name: "304", kind: "FREE" }, NOW),
    ).toEqual({
      kind: "invalid",
      errors: [{ field: "name", message: MESSAGES.ME502 }],
    });
    expect(db.room.create).not.toHaveBeenCalled();
    // 無効なものを除外していない(active の条件を付けない)
    expect(db.room.findFirst.mock.calls[0][0].where).toEqual({ name: "304" });
    db.room.findFirst.mockClear();
    await saveMaster(
      "rooms",
      { id: ID, version: VERSION, name: "304", kind: "FREE" },
      NOW,
    );
    expect(db.room.findFirst.mock.calls[0][0].where).toEqual({
      name: "304",
      id: { not: ID },
    });
  });

  it("講師のメールの重複は ME507、表記の重複は ME502", async () => {
    db.teacher.findFirst.mockImplementation(
      ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve("email" in where ? { id: "x" } : null),
    );
    expect(
      await saveMaster(
        "teachers",
        { displayName: "田村", email: "t@example.jp" },
        NOW,
      ),
    ).toEqual({
      kind: "invalid",
      errors: [{ field: "email", message: MESSAGES.ME507 }],
    });
  });

  it("クラスのホームルーム教室は、有効な教室だけ(ME706)", async () => {
    const input = { name: "A組", homeRoomId: ROOM, startYear: 2026 };
    db.room.findFirst.mockResolvedValue(null);
    expect(await saveMaster("classes", input, NOW)).toEqual({
      kind: "invalid",
      errors: [{ field: "homeRoomId", message: MESSAGES.ME706 }],
    });
    expect(db.schoolClass.create).not.toHaveBeenCalled();
    db.room.findFirst.mockResolvedValue({ id: ROOM });
    expect(await saveMaster("classes", input, NOW)).toMatchObject({
      kind: "saved",
    });
    expect(db.schoolClass.create).toHaveBeenCalledWith({
      data: { name: "A組", homeRoomId: ROOM, startYear: 2026, endYear: null },
    });
    // 形が違う教室ID は、DB に問い合わせない
    db.room.findFirst.mockClear();
    expect(
      await saveMaster("classes", { ...input, homeRoomId: "x'; drop" }, NOW),
    ).toMatchObject({ kind: "invalid" });
  });

  it("DBの一意の制約で断られたら(同時に同じ名前)、ME502", async () => {
    db.subject.create.mockRejectedValue(
      Object.assign(new Error("dup"), { code: "P2002" }),
    );
    expect(await saveMaster("subjects", { name: "英語A" }, NOW)).toEqual({
      kind: "invalid",
      errors: [{ field: "name", message: MESSAGES.ME502 }],
    });
    db.subject.create.mockRejectedValue(new Error("connection lost"));
    await expect(
      saveMaster("subjects", { name: "英語A" }, NOW),
    ).rejects.toThrow("connection lost");
  });

  it("編集は、画面が見た版のときだけ書く。ほかの人が先に変えていたら ME902(conflict)", async () => {
    tx.room.updateMany.mockResolvedValue({ count: 0 });
    expect(
      await saveMaster(
        "rooms",
        { id: ID, version: VERSION, name: "304", kind: "FREE" },
        NOW,
      ),
    ).toEqual({ kind: "conflict" });
    expect(tx.room.updateMany.mock.calls[0][0].where).toEqual({
      id: ID,
      updatedAt: new Date(VERSION),
    });
    // 行がもうなければ、not_found
    tx.room.count.mockResolvedValue(0);
    expect(
      await saveMaster(
        "rooms",
        { id: ID, version: VERSION, name: "304", kind: "FREE" },
        NOW,
      ),
    ).toEqual({ kind: "not_found" });
    // 版がない・読めないものは、書かない
    tx.room.updateMany.mockClear();
    for (const version of [undefined, "", "yesterday", 5]) {
      expect(
        await saveMaster(
          "rooms",
          { id: ID, version, name: "304", kind: "FREE" },
          NOW,
        ),
      ).toEqual({ kind: "conflict" });
    }
    expect(tx.room.updateMany).not.toHaveBeenCalled();
  });

  it("教室の名前を変えると、今日以降の授業の表示名も変える。過去は変えない(R5-3、MW501)", async () => {
    const result = await saveMaster(
      "rooms",
      { id: ID, version: VERSION, name: "３０４A", kind: "FREE" },
      NOW,
    );
    expect(result).toMatchObject({ kind: "saved", renamed: true });
    expect(tx.lesson.updateMany).toHaveBeenCalledWith({
      where: { roomId: ID, date: { gte: new Date("2026-11-10T00:00:00Z") } },
      data: { roomName: "304A" },
    });
  });

  it("教科・講師の名前も同じ。名前が変わらなければ授業に触らない", async () => {
    await saveMaster(
      "subjects",
      { id: ID, version: VERSION, name: "英語B" },
      NOW,
    );
    expect(tx.lesson.updateMany).toHaveBeenCalledWith({
      where: { subjectId: ID, date: { gte: new Date("2026-11-10T00:00:00Z") } },
      data: { subjectName: "英語B" },
    });
    await saveMaster(
      "teachers",
      { id: ID, version: VERSION, displayName: "田村 太郎" },
      NOW,
    );
    expect(tx.lessonTeacher.updateMany).toHaveBeenCalledWith({
      where: {
        teacherId: ID,
        lesson: { date: { gte: new Date("2026-11-10T00:00:00Z") } },
      },
      data: { teacherName: "田村 太郎" },
    });
    tx.lesson.updateMany.mockClear();
    tx.lessonTeacher.updateMany.mockClear();
    const same = await saveMaster(
      "subjects",
      { id: ID, version: VERSION, name: "英語A" },
      NOW,
    );
    expect(same).toMatchObject({ kind: "saved", renamed: false });
    expect(tx.lesson.updateMany).not.toHaveBeenCalled();
  });

  it("クラスの名前変更は授業に写さない(授業はクラスを指す)が、MW501 は出す", async () => {
    db.room.findFirst.mockResolvedValue({ id: ROOM });
    const result = await saveMaster(
      "classes",
      {
        id: ID,
        version: VERSION,
        name: "B組",
        homeRoomId: ROOM,
        startYear: 2026,
      },
      NOW,
    );
    expect(result).toMatchObject({ kind: "saved", renamed: true });
    expect(tx.lesson.updateMany).not.toHaveBeenCalled();
    expect(tx.schoolClass.updateMany.mock.calls[0][0].where).toEqual({
      id: ID,
      updatedAt: new Date(VERSION),
    });
  });

  it("種類・ID の形が違うものは not_found(DBに触らない)", async () => {
    for (const [kind, id] of [
      ["unknown", ID],
      ["rooms", "x' OR 1=1"],
      [undefined, ID],
    ] as const) {
      expect(
        await saveMaster(kind, { id, name: "x", kind: "FREE" }, NOW),
      ).toEqual({
        kind: "not_found",
      });
    }
    expect(db.room.findFirst).not.toHaveBeenCalled();
  });
});

describe("setMasterActive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const table of [db.schoolClass, db.subject, db.room, db.teacher]) {
      table.updateMany.mockResolvedValue({ count: 1 });
    }
  });
  it("無効 / 有効を切り替える。通知は別々", async () => {
    expect(await setMasterActive("rooms", ID, false, NOW)).toMatchObject({
      kind: "saved",
      notice: "MI502",
    });
    expect(db.room.updateMany).toHaveBeenCalledWith({
      where: { id: ID },
      data: { active: false },
    });
    expect(await setMasterActive("teachers", ID, true, NOW)).toMatchObject({
      notice: "MI502on",
    });
  });
  it("行がなければ not_found。形が違う入力は DB に触らない", async () => {
    db.room.updateMany.mockResolvedValue({ count: 0 });
    expect(await setMasterActive("rooms", ID, false, NOW)).toEqual({
      kind: "not_found",
    });
    db.room.updateMany.mockClear();
    for (const [kind, id, active] of [
      ["rooms", "x", false],
      ["rooms", ID, "false"],
      ["nope", ID, true],
      ["rooms", undefined, true],
    ] as const) {
      expect(await setMasterActive(kind, id, active, NOW)).toEqual({
        kind: "not_found",
      });
    }
    expect(db.room.updateMany).not.toHaveBeenCalled();
  });
});

describe("S21 の入り口", () => {
  const HOST = "mieroom.example";
  const SAME = { "sec-fetch-site": "same-origin", host: HOST };
  const post = (
    path: string,
    body: unknown,
    headers: Record<string, string> = SAME,
  ) =>
    new NextRequest(`https://${HOST}${path}`, {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "content-type": "application/json", ...headers },
    });
  const as = (role: "student" | "teacher" | "admin" | null) =>
    session.getCurrentUser.mockResolvedValue(
      role === null ? null : { id: "u1", name: "管理者", role },
    );
  const ROUTES = [
    ["/admin/masters/save", saveRoute, { kind: "subjects", name: "英語A" }],
    [
      "/admin/masters/active",
      activeRoute,
      { kind: "subjects", id: ID, active: false },
    ],
  ] as const;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    as("admin");
    for (const table of [db.schoolClass, db.subject, db.room, db.teacher]) {
      table.findFirst.mockResolvedValue(null);
      table.create.mockResolvedValue({});
      table.updateMany.mockResolvedValue({ count: 1 });
    }
  });

  describe.each(ROUTES)("%s", (path, route, body) => {
    it("時間割管理者だけ。先生・学生は 403、ログインなしは 401", async () => {
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
      expect(db.subject.create).not.toHaveBeenCalled();
      expect(db.subject.updateMany).not.toHaveBeenCalled();
    });
    it("同じサイトの画面からだけ", async () => {
      const others: Record<string, string>[] = [
        { "sec-fetch-site": "cross-site", host: HOST },
        { host: HOST },
        { origin: "https://evil.example", host: HOST },
      ];
      for (const headers of others) {
        expect((await route(post(path, body, headers))).status).toBe(403);
      }
    });
  });

  it("保存できたら 200 と通知。確認に通らなければ 400 と項目ごとの文言", async () => {
    const ok = await saveRoute(
      post("/admin/masters/save", { kind: "subjects", name: "英語A" }),
    );
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect(await ok.json()).toMatchObject({ notice: "MI501", renamed: false });
    const bad = await saveRoute(
      post("/admin/masters/save", { kind: "subjects", name: "" }),
    );
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({
      errors: [{ field: "name", message: MESSAGES.ME501 }],
    });
  });

  it("内部のエラーは 500 で、中身を出さない", async () => {
    db.subject.create.mockRejectedValue(new Error("postgres://u:p@h/db"));
    const response = await saveRoute(
      post("/admin/masters/save", { kind: "subjects", name: "英語A" }),
    );
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toMatch(/postgres|:p@/);
  });
});
