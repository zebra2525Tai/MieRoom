import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseClosure } from "@/lib/domain/closure-edit";
import { LOGIN_ERROR_MESSAGES, MESSAGES } from "@/lib/messages";

// S23 休み・行事: the rules for the input, saving and deleting, and the entry points.

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
  schoolClass: { findFirst: vi.fn() },
  closure: {
    create: vi.fn(),
    updateMany: vi.fn(),
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
  },
}));
vi.mock("@/lib/server/db", () => ({ getDb: () => db }));
vi.mock("@/lib/server/master-edit", () => ({
  countExportIssues: vi.fn().mockResolvedValue(1),
}));
vi.mock("@/lib/server/queries/common", () => ({ inYear: () => ({}) }));
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

import { POST as deleteRoute } from "@/app/(main)/admin/closures/delete/route";
import { POST as saveRoute } from "@/app/(main)/admin/closures/save/route";
import { deleteClosure, saveClosure } from "@/lib/server/closures-edit";

const ID = "5b0f2f3a-8a4e-4a39-8a5c-1e6a0a1d3b11";
const CLASS = "9c1d7e22-0d0e-4a7e-9a55-0f7b1d2a8c33";
const VERSION = "2026-11-01T00:00:00.000Z";
const NOW = new Date("2026-11-10T00:00:00Z");
const messages = (raw: unknown) => {
  const result = parseClosure(raw);
  return result.ok ? [] : result.errors.map((e) => `${e.field}:${e.message}`);
};

describe("休み・行事の規則", () => {
  const input = {
    startDate: "2026-11-03",
    endDate: "",
    name: "文化の日",
    classId: "",
  };

  it("終了日が空、または開始日と同じなら、1日だけ(null)。対象クラスが空なら全校(null)", () => {
    expect(parseClosure(input)).toEqual({
      ok: true,
      value: {
        startDate: "2026-11-03",
        endDate: null,
        name: "文化の日",
        classId: null,
      },
    });
    expect(parseClosure({ ...input, endDate: "2026-11-03" })).toMatchObject({
      ok: true,
      value: { endDate: null },
    });
    expect(
      parseClosure({ ...input, endDate: "2026-11-05", classId: CLASS }),
    ).toMatchObject({
      ok: true,
      value: { endDate: "2026-11-05", classId: CLASS },
    });
  });

  it("名称は必須で20文字まで(全角も半角も1文字)。前後の空白は取る", () => {
    expect(parseClosure({ ...input, name: "　学園祭 " })).toMatchObject({
      ok: true,
      value: { name: "学園祭" },
    });
    expect(parseClosure({ ...input, name: "あ".repeat(20) }).ok).toBe(true);
    expect(messages({ ...input, name: "あ".repeat(21) })).toEqual([
      `name:${MESSAGES.ME504(20)}`,
    ]);
    expect(messages({ ...input, name: " " })).toEqual([
      `name:${MESSAGES.ME501}`,
    ]);
  });

  it("開始日は必須。存在しない日付・範囲の外は ME520。終了日は開始日以降(ME519)", () => {
    expect(messages({ ...input, startDate: "" })).toEqual([
      `startDate:${MESSAGES.ME501}`,
    ]);
    for (const date of [
      "2026-02-30",
      "2026-13-01",
      "26-11-03",
      "abc",
      "1999-12-31",
      "2101-01-01",
    ]) {
      expect(messages({ ...input, startDate: date }), date).toEqual([
        `startDate:${MESSAGES.ME520}`,
      ]);
    }
    expect(messages({ ...input, endDate: "2026-11-02" })).toEqual([
      `endDate:${MESSAGES.ME519}`,
    ]);
    expect(messages({ ...input, endDate: "2026-02-30" })).toEqual([
      `endDate:${MESSAGES.ME520}`,
    ]);
  });

  it("形が違う入力は、落ちずに必須の誤りになる", () => {
    for (const raw of [null, "x", [], 5, {}]) {
      expect(messages(raw), String(raw)).toContain(
        `startDate:${MESSAGES.ME501}`,
      );
    }
  });
});

describe("saveClosure", () => {
  const input = { startDate: "2026-11-03", name: "文化の日" };
  beforeEach(() => {
    vi.clearAllMocks();
    db.schoolClass.findFirst.mockResolvedValue({ id: CLASS });
    db.closure.create.mockResolvedValue({});
    db.closure.updateMany.mockResolvedValue({ count: 1 });
    db.closure.findFirst.mockResolvedValue({ id: ID });
  });

  it("追加すると出どころは「システム」。保存の後、書き出し前の確認の件数も返す", async () => {
    expect(await saveClosure(input, NOW)).toEqual({
      kind: "saved",
      exportIssues: 1,
    });
    expect(db.closure.create).toHaveBeenCalledWith({
      data: {
        startDate: new Date("2026-11-03T00:00:00Z"),
        endDate: null,
        name: "文化の日",
        classId: null,
        source: "SYSTEM",
      },
    });
  });

  it("本文で出どころ(source)を指定しても使わない", async () => {
    await saveClosure({ ...input, source: "TOOL", targetMonth: "202611" }, NOW);
    expect(db.closure.create.mock.calls[0][0].data.source).toBe("SYSTEM");
    expect(db.closure.create.mock.calls[0][0].data).not.toHaveProperty(
      "targetMonth",
    );
  });

  it("クラスを指定するときは、その年度に存在する有効なクラスだけ(ME706)", async () => {
    db.schoolClass.findFirst.mockResolvedValue(null);
    expect(await saveClosure({ ...input, classId: CLASS }, NOW)).toEqual({
      kind: "invalid",
      errors: [{ field: "classId", message: MESSAGES.ME706 }],
    });
    db.schoolClass.findFirst.mockClear();
    expect(
      await saveClosure({ ...input, classId: "x' OR 1=1" }, NOW),
    ).toMatchObject({
      kind: "invalid",
    });
    expect(db.schoolClass.findFirst).not.toHaveBeenCalled();
    expect(db.closure.create).not.toHaveBeenCalled();
  });

  it("確認に通らなければ、何も書かない", async () => {
    expect(await saveClosure({ ...input, name: "" }, NOW)).toMatchObject({
      kind: "invalid",
    });
    expect(db.closure.create).not.toHaveBeenCalled();
  });

  it("編集: システムで作った行を、画面が見た版のときだけ書き換える", async () => {
    expect(
      await saveClosure({ ...input, id: ID, version: VERSION }, NOW),
    ).toMatchObject({
      kind: "saved",
    });
    expect(db.closure.updateMany).toHaveBeenCalledWith({
      where: { id: ID, source: "SYSTEM", updatedAt: new Date(VERSION) },
      data: expect.objectContaining({ name: "文化の日" }),
    });
  });

  it("先に変更されていたら conflict、行がない(またはツールの行)なら not_found", async () => {
    db.closure.updateMany.mockResolvedValue({ count: 0 });
    expect(
      await saveClosure({ ...input, id: ID, version: VERSION }, NOW),
    ).toEqual({
      kind: "conflict",
    });
    db.closure.findFirst.mockResolvedValue(null);
    expect(
      await saveClosure({ ...input, id: ID, version: VERSION }, NOW),
    ).toEqual({
      kind: "not_found",
    });
    db.closure.updateMany.mockClear();
    for (const version of [undefined, "", "yesterday", 5]) {
      expect(await saveClosure({ ...input, id: ID, version }, NOW)).toEqual({
        kind: "conflict",
      });
    }
    expect(await saveClosure({ ...input, id: "x'; drop" }, NOW)).toEqual({
      kind: "not_found",
    });
    expect(db.closure.updateMany).not.toHaveBeenCalled();
  });
});

describe("deleteClosure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.closure.deleteMany.mockResolvedValue({ count: 1 });
  });
  it("システムで作った行だけ消す(ツールの行は消さない)", async () => {
    expect(await deleteClosure(ID, NOW)).toEqual({
      kind: "saved",
      exportIssues: 1,
    });
    expect(db.closure.deleteMany).toHaveBeenCalledWith({
      where: { id: ID, source: "SYSTEM" },
    });
  });
  it("行がなければ not_found。形が違う ID は DB に触らない", async () => {
    db.closure.deleteMany.mockResolvedValue({ count: 0 });
    expect(await deleteClosure(ID, NOW)).toEqual({ kind: "not_found" });
    db.closure.deleteMany.mockClear();
    for (const id of [undefined, null, 5, "x' OR 1=1", ""]) {
      expect(await deleteClosure(id, NOW)).toEqual({ kind: "not_found" });
    }
    expect(db.closure.deleteMany).not.toHaveBeenCalled();
  });
});

describe("S23 の入り口", () => {
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
    [
      "/admin/closures/save",
      saveRoute,
      { startDate: "2026-11-03", name: "文化の日" },
    ],
    ["/admin/closures/delete", deleteRoute, { id: ID }],
  ] as const;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    as("admin");
    db.closure.create.mockResolvedValue({});
    db.closure.deleteMany.mockResolvedValue({ count: 1 });
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
      expect(db.closure.create).not.toHaveBeenCalled();
      expect(db.closure.deleteMany).not.toHaveBeenCalled();
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
    it("できたら 200 と MI501。応答は保存させない", async () => {
      const response = await route(post(path, body));
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({
        notice: "MI501",
        exportIssues: 1,
      });
    });
    it("内部のエラーは 500 で、中身を出さない", async () => {
      db.closure.create.mockRejectedValue(new Error("postgres://u:p@h/db"));
      db.closure.deleteMany.mockRejectedValue(new Error("postgres://u:p@h/db"));
      const response = await route(post(path, body));
      expect(response.status).toBe(500);
      expect(JSON.stringify(await response.json())).not.toMatch(/postgres|:p@/);
    });
  });

  it("確認に通らなければ 400 と項目ごとの文言", async () => {
    const response = await saveRoute(
      post("/admin/closures/save", { startDate: "2026-11-03", name: "" }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      errors: [{ field: "name", message: MESSAGES.ME501 }],
    });
  });
});
