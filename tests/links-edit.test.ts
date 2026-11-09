import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOGIN_ERROR_MESSAGES, MESSAGES } from "@/lib/messages";

// S22 紐づけ: adding and deleting the rows of the three tables, and the entry points.

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
  schoolClass: { findFirst: vi.fn() },
  subject: { findFirst: vi.fn() },
  teacher: { findFirst: vi.fn() },
  room: { findFirst: vi.fn() },
  classSubject: { create: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
  subjectTeacher: { create: vi.fn(), deleteMany: vi.fn() },
  subjectRoom: { create: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock("@/lib/server/db", () => ({ getDb: () => db }));
vi.mock("@/lib/server/master-edit", () => ({
  countExportIssues: vi.fn().mockResolvedValue(2),
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

import { POST as addRoute } from "@/app/(main)/admin/links/add/route";
import { POST as removeRoute } from "@/app/(main)/admin/links/remove/route";
import { addLink, removeLink } from "@/lib/server/links-edit";

const CLASS = "5b0f2f3a-8a4e-4a39-8a5c-1e6a0a1d3b11";
const SUBJECT = "9c1d7e22-0d0e-4a7e-9a55-0f7b1d2a8c33";
const TEACHER = "11111111-2222-4333-8444-555555555555";
const ROOM = "66666666-7777-4888-8999-aaaaaaaaaaaa";
const NOW = new Date("2026-11-10T00:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  db.schoolClass.findFirst.mockResolvedValue({ id: CLASS });
  db.subject.findFirst.mockResolvedValue({ id: SUBJECT });
  db.teacher.findFirst.mockResolvedValue({ id: TEACHER });
  db.room.findFirst.mockResolvedValue({ id: ROOM });
  db.classSubject.findUnique.mockResolvedValue({ classId: CLASS });
  for (const table of [db.classSubject, db.subjectTeacher, db.subjectRoom]) {
    table.create.mockResolvedValue({});
    table.deleteMany.mockResolvedValue({ count: 1 });
  }
});

describe("addLink", () => {
  it("クラスの教科を足す。保存の後、書き出し前の確認の件数も返す", async () => {
    expect(
      await addLink("subjects", { classId: CLASS, subjectId: SUBJECT }, NOW),
    ).toEqual({
      kind: "saved",
      exportIssues: 2,
    });
    expect(db.classSubject.create).toHaveBeenCalledWith({
      data: { classId: CLASS, subjectId: SUBJECT },
    });
  });

  it("教科の講師: 講師と、「各担当」(講師なしの行)を足せる", async () => {
    await addLink(
      "teachers",
      { classId: CLASS, subjectId: SUBJECT, teacherId: TEACHER },
      NOW,
    );
    expect(db.subjectTeacher.create).toHaveBeenLastCalledWith({
      data: {
        classId: CLASS,
        subjectId: SUBJECT,
        teacherId: TEACHER,
        teacherKey: TEACHER,
      },
    });
    await addLink(
      "teachers",
      { classId: CLASS, subjectId: SUBJECT, teacherId: "each" },
      NOW,
    );
    expect(db.subjectTeacher.create).toHaveBeenLastCalledWith({
      data: {
        classId: CLASS,
        subjectId: SUBJECT,
        teacherId: null,
        teacherKey: "each",
      },
    });
  });

  it("教科の教室: 教室と、「ー(教室未定)」を足せる", async () => {
    await addLink(
      "rooms",
      { classId: CLASS, subjectId: SUBJECT, roomId: ROOM },
      NOW,
    );
    expect(db.subjectRoom.create).toHaveBeenLastCalledWith({
      data: { classId: CLASS, subjectId: SUBJECT, roomId: ROOM, roomKey: ROOM },
    });
    await addLink(
      "rooms",
      { classId: CLASS, subjectId: SUBJECT, roomId: "none" },
      NOW,
    );
    expect(db.subjectRoom.create).toHaveBeenLastCalledWith({
      data: {
        classId: CLASS,
        subjectId: SUBJECT,
        roomId: null,
        roomKey: "none",
      },
    });
  });

  it("同じ組み合わせは ME506(DBの一意の制約で)", async () => {
    const dup = Object.assign(new Error("dup"), { code: "P2002" });
    db.classSubject.create.mockRejectedValue(dup);
    db.subjectTeacher.create.mockRejectedValue(dup);
    db.subjectRoom.create.mockRejectedValue(dup);
    const expected = { kind: "invalid", message: MESSAGES.ME506 };
    expect(
      await addLink("subjects", { classId: CLASS, subjectId: SUBJECT }, NOW),
    ).toEqual(expected);
    expect(
      await addLink(
        "teachers",
        { classId: CLASS, subjectId: SUBJECT, teacherId: "each" },
        NOW,
      ),
    ).toEqual(expected);
    expect(
      await addLink(
        "rooms",
        { classId: CLASS, subjectId: SUBJECT, roomId: "none" },
        NOW,
      ),
    ).toEqual(expected);
  });

  it("DBの別のエラーは、そのまま投げる", async () => {
    db.classSubject.create.mockRejectedValue(new Error("connection lost"));
    await expect(
      addLink("subjects", { classId: CLASS, subjectId: SUBJECT }, NOW),
    ).rejects.toThrow("connection lost");
  });

  it("無効な教科・講師・教室、クラスの教科でない教科は ME706。何も書かない", async () => {
    const invalid = { kind: "invalid", message: MESSAGES.ME706 };
    db.subject.findFirst.mockResolvedValue(null);
    expect(
      await addLink("subjects", { classId: CLASS, subjectId: SUBJECT }, NOW),
    ).toEqual(invalid);
    db.subject.findFirst.mockResolvedValue({ id: SUBJECT });
    db.classSubject.findUnique.mockResolvedValue(null);
    expect(
      await addLink(
        "teachers",
        { classId: CLASS, subjectId: SUBJECT, teacherId: "each" },
        NOW,
      ),
    ).toEqual(invalid);
    db.classSubject.findUnique.mockResolvedValue({ classId: CLASS });
    db.teacher.findFirst.mockResolvedValue(null);
    expect(
      await addLink(
        "teachers",
        { classId: CLASS, subjectId: SUBJECT, teacherId: TEACHER },
        NOW,
      ),
    ).toEqual(invalid);
    db.room.findFirst.mockResolvedValue(null);
    expect(
      await addLink(
        "rooms",
        { classId: CLASS, subjectId: SUBJECT, roomId: ROOM },
        NOW,
      ),
    ).toEqual(invalid);
    for (const bad of ["x' OR 1=1", "", undefined, 5]) {
      expect(
        await addLink(
          "teachers",
          { classId: CLASS, subjectId: SUBJECT, teacherId: bad },
          NOW,
        ),
      ).toEqual(invalid);
    }
    expect(db.subjectTeacher.create).not.toHaveBeenCalled();
    expect(db.subjectRoom.create).not.toHaveBeenCalled();
    expect(db.classSubject.create).not.toHaveBeenCalled();
  });

  it("今年度に存在しない・無効なクラスや、形が違う ID は not_found", async () => {
    db.schoolClass.findFirst.mockResolvedValue(null);
    expect(
      await addLink("subjects", { classId: CLASS, subjectId: SUBJECT }, NOW),
    ).toEqual({
      kind: "not_found",
    });
    db.schoolClass.findFirst.mockClear();
    for (const body of [
      { classId: "x", subjectId: SUBJECT },
      { classId: CLASS, subjectId: "x" },
      { classId: CLASS },
      {},
    ]) {
      expect(await addLink("subjects", body, NOW)).toEqual({
        kind: "not_found",
      });
    }
    expect(
      await addLink("other", { classId: CLASS, subjectId: SUBJECT }, NOW),
    ).toEqual({
      kind: "not_found",
    });
    expect(db.classSubject.create).not.toHaveBeenCalled();
  });
});

describe("removeLink", () => {
  it("1行を消す。キーで、その行だけ", async () => {
    await removeLink("subjects", { classId: CLASS, subjectId: SUBJECT }, NOW);
    expect(db.classSubject.deleteMany).toHaveBeenCalledWith({
      where: { classId: CLASS, subjectId: SUBJECT },
    });
    await removeLink(
      "teachers",
      { classId: CLASS, subjectId: SUBJECT, targetKey: "each" },
      NOW,
    );
    expect(db.subjectTeacher.deleteMany).toHaveBeenCalledWith({
      where: { classId: CLASS, subjectId: SUBJECT, teacherKey: "each" },
    });
    await removeLink(
      "rooms",
      { classId: CLASS, subjectId: SUBJECT, targetKey: ROOM },
      NOW,
    );
    expect(db.subjectRoom.deleteMany).toHaveBeenCalledWith({
      where: { classId: CLASS, subjectId: SUBJECT, roomKey: ROOM },
    });
  });

  it("行がなければ not_found。キーの形が違うものは DB に触らない", async () => {
    db.subjectRoom.deleteMany.mockResolvedValue({ count: 0 });
    expect(
      await removeLink(
        "rooms",
        { classId: CLASS, subjectId: SUBJECT, targetKey: ROOM },
        NOW,
      ),
    ).toEqual({ kind: "not_found" });
    db.subjectTeacher.deleteMany.mockClear();
    for (const targetKey of ["", "x' OR 1=1", undefined, 5, "none"]) {
      expect(
        await removeLink(
          "teachers",
          { classId: CLASS, subjectId: SUBJECT, targetKey },
          NOW,
        ),
      ).toEqual({ kind: "not_found" });
    }
    expect(db.subjectTeacher.deleteMany).not.toHaveBeenCalled();
  });
});

describe("S22 の入り口", () => {
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
      "/admin/links/add",
      addRoute,
      { tab: "subjects", classId: CLASS, subjectId: SUBJECT },
    ],
    [
      "/admin/links/remove",
      removeRoute,
      { tab: "subjects", classId: CLASS, subjectId: SUBJECT },
    ],
  ] as const;

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    as("admin");
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
      expect(db.classSubject.create).not.toHaveBeenCalled();
      expect(db.classSubject.deleteMany).not.toHaveBeenCalled();
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
        exportIssues: 2,
      });
    });
    it("内部のエラーは 500 で、中身を出さない", async () => {
      db.classSubject.create.mockRejectedValue(
        new Error("postgres://u:p@h/db"),
      );
      db.classSubject.deleteMany.mockRejectedValue(
        new Error("postgres://u:p@h/db"),
      );
      const response = await route(post(path, body));
      expect(response.status).toBe(500);
      expect(JSON.stringify(await response.json())).not.toMatch(/postgres|:p@/);
    });
  });

  it("重複は 400 と ME506、行がなければ 404 と ME902", async () => {
    db.classSubject.create.mockRejectedValue(
      Object.assign(new Error("dup"), { code: "P2002" }),
    );
    const dup = await addRoute(post("/admin/links/add", ROUTES[0][2]));
    expect(dup.status).toBe(400);
    expect(await dup.json()).toEqual({ message: MESSAGES.ME506 });
    db.classSubject.deleteMany.mockResolvedValue({ count: 0 });
    const gone = await removeRoute(post("/admin/links/remove", ROUTES[1][2]));
    expect(gone.status).toBe(404);
    expect(await gone.json()).toEqual({ message: MESSAGES.ME902 });
  });
});
