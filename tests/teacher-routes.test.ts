import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOGIN_ERROR_MESSAGES, MESSAGES } from "@/lib/messages";

// The routes of 先生's operations: who may call them and what comes back.
// The session and the work are replaced; the rest is the real route code.

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  approveReservation: vi.fn(),
  rejectReservation: vi.fn(),
  cancelReservation: vi.fn(),
  createProxyReservation: vi.fn(),
  createBlock: vi.fn(),
  releaseBlock: vi.fn(),
}));
vi.mock("@/lib/server/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
  hasRole: (user: { role: string }, role: string) =>
    role === "admin"
      ? user.role === "admin"
      : role === "teacher"
        ? user.role !== "student"
        : true,
}));
vi.mock("@/lib/server/teacher-actions", () => ({
  approveReservation: mocks.approveReservation,
  rejectReservation: mocks.rejectReservation,
  cancelReservation: mocks.cancelReservation,
  createProxyReservation: mocks.createProxyReservation,
  createBlock: mocks.createBlock,
  releaseBlock: mocks.releaseBlock,
}));

import { POST as release } from "@/app/(main)/teacher/blocks/release/route";
import { POST as create } from "@/app/(main)/teacher/blocks/create/route";
import { POST as approve } from "@/app/(main)/teacher/reservations/approve/route";
import { POST as cancel } from "@/app/(main)/teacher/reservations/cancel/route";
import { POST as proxy } from "@/app/(main)/teacher/reservations/proxy/route";
import { POST as reject } from "@/app/(main)/teacher/reservations/reject/route";

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
  mocks.getCurrentUser.mockResolvedValue(
    role === null ? null : { id: "t1", name: "田村", role },
  );

const ROUTES = [
  ["/teacher/reservations/approve", approve, mocks.approveReservation],
  ["/teacher/reservations/reject", reject, mocks.rejectReservation],
  ["/teacher/reservations/cancel", cancel, mocks.cancelReservation],
  ["/teacher/reservations/proxy", proxy, mocks.createProxyReservation],
  ["/teacher/blocks/create", create, mocks.createBlock],
  ["/teacher/blocks/release", release, mocks.releaseBlock],
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  as("teacher");
  mocks.approveReservation.mockResolvedValue({ kind: "done", notice: "MI201" });
  mocks.rejectReservation.mockResolvedValue({ kind: "done", notice: "MI202" });
  mocks.cancelReservation.mockResolvedValue({ kind: "done", notice: "MI203" });
  mocks.createProxyReservation.mockResolvedValue({ kind: "created", id: "r1" });
  mocks.createBlock.mockResolvedValue({
    kind: "created",
    reservations: 2,
    lessons: 1,
  });
  mocks.releaseBlock.mockResolvedValue("released");
});

describe.each(ROUTES)("%s: 入り口の確認", (path, route, work) => {
  it("学生は使えない(403 ME004)。何もしない", async () => {
    as("student");
    const response = await route(post(path, { id: "x" }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: MESSAGES.ME004 });
    expect(work).not.toHaveBeenCalled();
  });

  it("ログインしていなければ 401(ME005)", async () => {
    as(null);
    const response = await route(post(path, { id: "x" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      message: LOGIN_ERROR_MESSAGES.ME005,
    });
    expect(work).not.toHaveBeenCalled();
  });

  it("同じサイトの画面からだけ受ける", async () => {
    const others: Record<string, string>[] = [
      { "sec-fetch-site": "cross-site", host: HOST },
      { "sec-fetch-site": "same-site", host: HOST },
      { host: HOST },
      { origin: "https://evil.example", host: HOST },
    ];
    for (const headers of others) {
      expect((await route(post(path, { id: "x" }, headers))).status).toBe(403);
    }
    expect(work).not.toHaveBeenCalled();
  });

  it("読めない本文は 400、大きすぎる本文は 413", async () => {
    expect((await route(post(path, "{nope"))).status).toBe(400);
    expect((await route(post(path, { id: "x".repeat(20_000) }))).status).toBe(
      413,
    );
    expect(work).not.toHaveBeenCalled();
  });

  it("先生と時間割管理者は使える。応答は保存させない", async () => {
    for (const role of ["teacher", "admin"] as const) {
      as(role);
      const response = await route(post(path, { id: "x" }));
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("内部のエラーは 500 で、中身を出さない", async () => {
    work.mockRejectedValue(
      new Error("connect ECONNREFUSED postgres://u:p@h/db"),
    );
    const response = await route(post(path, { id: "x" }));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toMatch(
      /postgres|ECONNREFUSED|:p@/,
    );
  });
});

describe("承認・却下・取消", () => {
  it("できたら通知の ID を返す。ID と confirmed を渡す", async () => {
    const response = await approve(
      post("/teacher/reservations/approve", { id: "r1", confirmed: true }),
    );
    expect(await response.json()).toEqual({ notice: "MI201" });
    const call = mocks.approveReservation.mock.calls[0];
    expect(call[0]).toEqual({ id: "t1", name: "田村", role: "teacher" });
    expect(call[1]).toBe("r1");
    expect(call[2]).toBe(true);
  });

  it("confirmed は true のときだけ true(文字や数では確認したことにならない)", async () => {
    for (const confirmed of ["true", 1, "yes", null]) {
      await approve(
        post("/teacher/reservations/approve", { id: "r1", confirmed }),
      );
    }
    for (const call of mocks.approveReservation.mock.calls) {
      expect(call[2]).toBe(false);
    }
  });

  it("確認が要るとき(MC201)は 409 と confirm", async () => {
    mocks.approveReservation.mockResolvedValue({
      kind: "confirm",
      message: MESSAGES.MC201,
    });
    const response = await approve(
      post("/teacher/reservations/approve", { id: "r1" }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      confirm: true,
      message: MESSAGES.MC201,
    });
  });

  it("断られたときは 409 と理由、存在しないときは 404", async () => {
    mocks.rejectReservation.mockResolvedValue({
      kind: "refused",
      message: MESSAGES.ME902,
    });
    const refused = await reject(
      post("/teacher/reservations/reject", { id: "r1" }),
    );
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ message: MESSAGES.ME902 });
    mocks.cancelReservation.mockResolvedValue({ kind: "not_found" });
    expect(
      (await cancel(post("/teacher/reservations/cancel", { id: "zz" }))).status,
    ).toBe(404);
  });

  it("id がない本文でも落ちない(id なしとして扱う)", async () => {
    for (const body of [[], null, "x", {}]) {
      await reject(post("/teacher/reservations/reject", body));
    }
    for (const call of mocks.rejectReservation.mock.calls) {
      expect(call[1]).toBeUndefined();
    }
  });
});

describe("代理入力", () => {
  it("できたら MI204。confirmed は入力から切り離して渡す", async () => {
    const response = await proxy(
      post("/teacher/reservations/proxy", {
        roomId: "x",
        confirmed: true,
        applicantId: "evil",
      }),
    );
    expect(await response.json()).toEqual({ id: "r1", notice: "MI204" });
    const [user, input, confirmed] = mocks.createProxyReservation.mock.calls[0];
    expect(user.id).toBe("t1");
    expect(confirmed).toBe(true);
    expect(input).not.toHaveProperty("confirmed");
  });

  it("確認が要るとき・確認に通らないとき・形が違うとき", async () => {
    mocks.createProxyReservation.mockResolvedValue({
      kind: "confirm",
      message: MESSAGES.MC201,
    });
    expect((await proxy(post("/teacher/reservations/proxy", {}))).status).toBe(
      409,
    );
    const issues = [
      { code: "ME107", field: "purpose", message: MESSAGES.ME107 },
    ];
    mocks.createProxyReservation.mockResolvedValue({ kind: "invalid", issues });
    const invalid = await proxy(post("/teacher/reservations/proxy", {}));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ issues });
    mocks.createProxyReservation.mockResolvedValue({ kind: "bad_request" });
    expect((await proxy(post("/teacher/reservations/proxy", {}))).status).toBe(
      400,
    );
  });
});

describe("使用止め", () => {
  it("設定できたら MI301 と、重なる数(MW301、MW302)", async () => {
    const response = await create(post("/teacher/blocks/create", { a: 1 }));
    expect(await response.json()).toEqual({
      notice: "MI301",
      reservations: 2,
      lessons: 1,
    });
  });

  it("ME301・ME302・ME109 は 400 と文言", async () => {
    mocks.createBlock.mockResolvedValue({
      kind: "invalid",
      message: MESSAGES.ME302,
    });
    const response = await create(post("/teacher/blocks/create", {}));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: MESSAGES.ME302 });
  });

  it("解除できたら MI302、すでになければ 404", async () => {
    expect(
      await (
        await release(post("/teacher/blocks/release", { id: "b1" }))
      ).json(),
    ).toEqual({ notice: "MI302" });
    mocks.releaseBlock.mockResolvedValue("not_found");
    const gone = await release(post("/teacher/blocks/release", { id: "b1" }));
    expect(gone.status).toBe(404);
    expect(await gone.json()).toEqual({ message: MESSAGES.ME902 });
  });
});
