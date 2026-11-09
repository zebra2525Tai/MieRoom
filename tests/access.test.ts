import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeReceiverId, normalizeTagId } from "@/lib/domain/access";
import { LOGIN_ERROR_MESSAGES, MESSAGES } from "@/lib/messages";

// S25 タグ・受信機: the rules for the IDs, the server work, and the entry points.

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
  teacher: { findFirst: vi.fn(), update: vi.fn() },
  location: { deleteMany: vi.fn() },
  room: { findFirst: vi.fn() },
  receiver: { create: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/server/db", () => ({ getDb: () => db }));
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

import { POST as removeRoute } from "@/app/(main)/admin/access/receiver/remove/route";
import { POST as receiverRoute } from "@/app/(main)/admin/access/receiver/route";
import { POST as tagRoute } from "@/app/(main)/admin/access/tag/route";
import { addReceiver, removeReceiver, setTagId } from "@/lib/server/access";

const TEACHER = "5b0f2f3a-8a4e-4a39-8a5c-1e6a0a1d3b11";
const ROOM = "9c1d7e22-0d0e-4a7e-9a55-0f7b1d2a8c33";

describe("タグID の規則", () => {
  it("0〜65535 の整数を、ゲートウェイの数と同じ文字にして保存する", () => {
    expect(normalizeTagId("12")).toEqual({ ok: true, value: "12" });
    expect(normalizeTagId(" 012 ")).toEqual({ ok: true, value: "12" });
    expect(normalizeTagId("０")).toEqual({ ok: true, value: "0" });
    expect(normalizeTagId("１２")).toEqual({ ok: true, value: "12" });
    expect(normalizeTagId("65535")).toEqual({ ok: true, value: "65535" });
  });
  it("範囲の外・数字でないものは受け付けない", () => {
    for (const text of [
      "65536",
      "-1",
      "1.5",
      "1e3",
      "abc",
      "12 3",
      "0x1f",
      "+5",
    ]) {
      expect(normalizeTagId(text), text).toEqual({ ok: false, code: "ME513" });
    }
    expect(normalizeTagId("123456")).toEqual({ ok: false, code: "ME513" });
  });
  it("空は必須(ME501)", () => {
    expect(normalizeTagId("  ")).toEqual({ ok: false, code: "ME501" });
  });
});

describe("受信機ID の規則", () => {
  it("英数字と . _ - を、64文字まで", () => {
    for (const text of ["304", "room-304", "A_1.b", "x".repeat(64)]) {
      expect(normalizeReceiverId(text)).toEqual({ ok: true, value: text });
    }
    expect(normalizeReceiverId(" ３０４ ")).toEqual({ ok: true, value: "304" });
  });
  it("空白・記号・日本語・長すぎるものは受け付けない", () => {
    for (const text of [
      "a b",
      "a/b",
      "a'b",
      "<x>",
      "教室",
      "x".repeat(65),
      "a;b",
    ]) {
      expect(normalizeReceiverId(text), text).toEqual({
        ok: false,
        code: "ME514",
      });
    }
    expect(normalizeReceiverId("")).toEqual({ ok: false, code: "ME501" });
  });
});

describe("setTagId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.teacher.findFirst.mockResolvedValue({ tagId: null });
    db.teacher.update.mockReturnValue("update");
    db.location.deleteMany.mockReturnValue("delete");
    db.$transaction.mockResolvedValue([]);
  });

  it("タグを登録する。位置の行を一緒に消す(古いタグの位置を残さない)", async () => {
    expect(await setTagId(TEACHER, "012")).toEqual({
      kind: "done",
      notice: "MI501",
    });
    expect(db.teacher.update).toHaveBeenCalledWith({
      where: { id: TEACHER },
      data: { tagId: "12" },
    });
    expect(db.location.deleteMany).toHaveBeenCalledWith({
      where: { teacherId: TEACHER },
    });
    expect(db.$transaction).toHaveBeenCalledWith(["update", "delete"]);
  });

  it("空にすると、タグを外す(null)", async () => {
    db.teacher.findFirst.mockResolvedValue({ tagId: "12" });
    for (const empty of ["", "  ", null]) {
      db.$transaction.mockClear();
      expect(await setTagId(TEACHER, empty)).toEqual({
        kind: "done",
        notice: "MI501",
      });
      expect(db.teacher.update).toHaveBeenLastCalledWith({
        where: { id: TEACHER },
        data: { tagId: null },
      });
      expect(db.$transaction).toHaveBeenCalledTimes(1);
    }
  });

  it("同じ値なら何もしない(位置も消さない)", async () => {
    db.teacher.findFirst.mockResolvedValue({ tagId: "12" });
    expect(await setTagId(TEACHER, "12")).toEqual({
      kind: "done",
      notice: "MI501",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("ほかの講師が持つ番号は ME509(DBの一意の制約で)。何も書き換わらない", async () => {
    db.$transaction.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );
    expect(await setTagId(TEACHER, "12")).toEqual({
      kind: "invalid",
      message: MESSAGES.ME509,
    });
  });

  it("DBの別のエラーは、そのまま投げる(中身は入り口が隠す)", async () => {
    db.$transaction.mockRejectedValue(new Error("connection lost"));
    await expect(setTagId(TEACHER, "12")).rejects.toThrow("connection lost");
  });

  it("形が違う値は、DBに触らず断る", async () => {
    expect(await setTagId(TEACHER, "abc")).toEqual({
      kind: "invalid",
      message: MESSAGES.ME513,
    });
    expect(await setTagId(TEACHER, "70000")).toEqual({
      kind: "invalid",
      message: MESSAGES.ME513,
    });
    for (const id of [undefined, null, 5, "x' OR 1=1", "../x"]) {
      expect(await setTagId(id, "12")).toEqual({ kind: "not_found" });
    }
    expect(await setTagId(TEACHER, 12)).toEqual({ kind: "not_found" });
    expect(db.teacher.findFirst).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "x' OR 1=1", active: true } }),
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("無効な講師・いない講師は not_found", async () => {
    db.teacher.findFirst.mockResolvedValue(null);
    expect(await setTagId(TEACHER, "12")).toEqual({ kind: "not_found" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("受信機", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.room.findFirst.mockResolvedValue({ id: ROOM });
    db.receiver.create.mockResolvedValue({});
    db.receiver.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("教室に受信機IDを登録する", async () => {
    expect(await addReceiver(ROOM, " ３０４ ")).toEqual({
      kind: "done",
      notice: "MI501",
    });
    expect(db.receiver.create).toHaveBeenCalledWith({
      data: { receiverId: "304", roomId: ROOM },
    });
  });

  it("同じ受信機IDは ME509。形が違うものは書かない", async () => {
    db.receiver.create.mockRejectedValue(
      Object.assign(new Error("dup"), { code: "P2002" }),
    );
    expect(await addReceiver(ROOM, "304")).toEqual({
      kind: "invalid",
      message: MESSAGES.ME509,
    });
    db.receiver.create.mockClear();
    expect(await addReceiver(ROOM, "a b")).toEqual({
      kind: "invalid",
      message: MESSAGES.ME514,
    });
    expect(db.receiver.create).not.toHaveBeenCalled();
  });

  it("無効・存在しない教室、形が違う教室IDは not_found", async () => {
    db.room.findFirst.mockResolvedValue(null);
    expect(await addReceiver(ROOM, "304")).toEqual({ kind: "not_found" });
    db.room.findFirst.mockClear();
    expect(await addReceiver("x'; drop", "304")).toEqual({ kind: "not_found" });
    expect(db.room.findFirst).not.toHaveBeenCalled();
  });

  it("外す: 行があれば消す。なければ not_found", async () => {
    expect(await removeReceiver(ROOM)).toEqual({
      kind: "done",
      notice: "MI501",
    });
    db.receiver.deleteMany.mockResolvedValue({ count: 0 });
    expect(await removeReceiver(ROOM)).toEqual({ kind: "not_found" });
    db.receiver.deleteMany.mockClear();
    expect(await removeReceiver("x' OR 1=1")).toEqual({ kind: "not_found" });
    expect(db.receiver.deleteMany).not.toHaveBeenCalled();
  });
});

describe("S25 の入り口", () => {
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
    ["/admin/access/tag", tagRoute, { teacherId: TEACHER, tagId: "12" }],
    [
      "/admin/access/receiver",
      receiverRoute,
      { roomId: ROOM, receiverId: "304" },
    ],
    ["/admin/access/receiver/remove", removeRoute, { id: ROOM }],
  ] as const;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    as("admin");
    db.teacher.findFirst.mockResolvedValue({ tagId: null });
    db.teacher.update.mockReturnValue("u");
    db.location.deleteMany.mockReturnValue("d");
    db.$transaction.mockResolvedValue([]);
    db.room.findFirst.mockResolvedValue({ id: ROOM });
    db.receiver.create.mockResolvedValue({});
    db.receiver.deleteMany.mockResolvedValue({ count: 1 });
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
      expect(db.$transaction).not.toHaveBeenCalled();
      expect(db.receiver.create).not.toHaveBeenCalled();
      expect(db.receiver.deleteMany).not.toHaveBeenCalled();
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
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("できたら MI501、本文が読めなければ 400、応答は保存させない", async () => {
      const ok = await route(post(path, body));
      expect(ok.status).toBe(200);
      expect(await ok.json()).toEqual({ notice: "MI501" });
      expect(ok.headers.get("cache-control")).toBe("no-store");
      expect((await route(post(path, "{nope"))).status).toBe(400);
    });

    it("内部のエラーは 500 で、中身を出さない", async () => {
      db.$transaction.mockRejectedValue(new Error("postgres://u:p@h/db"));
      db.receiver.create.mockRejectedValue(new Error("postgres://u:p@h/db"));
      db.receiver.deleteMany.mockRejectedValue(
        new Error("postgres://u:p@h/db"),
      );
      const response = await route(post(path, body));
      expect(response.status).toBe(500);
      expect(JSON.stringify(await response.json())).not.toMatch(/postgres|:p@/);
    });
  });

  it("重複は 400 と ME509、行がなければ 404 と ME902", async () => {
    db.$transaction.mockRejectedValue(
      Object.assign(new Error("dup"), { code: "P2002" }),
    );
    const dup = await tagRoute(
      post("/admin/access/tag", { teacherId: TEACHER, tagId: "12" }),
    );
    expect(dup.status).toBe(400);
    expect(await dup.json()).toEqual({ message: MESSAGES.ME509 });
    db.receiver.deleteMany.mockResolvedValue({ count: 0 });
    const gone = await removeRoute(
      post("/admin/access/receiver/remove", { id: ROOM }),
    );
    expect(gone.status).toBe(404);
    expect(await gone.json()).toEqual({ message: MESSAGES.ME902 });
  });
});
