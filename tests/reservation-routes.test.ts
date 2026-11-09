import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOGIN_ERROR_MESSAGES, MESSAGES } from "@/lib/messages";

// The two routes of S06 and S07: who may call them and what comes back.
// The session and the writing are replaced; the rest is the real route code.

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  createReservation: vi.fn(),
  withdrawReservation: vi.fn(),
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
vi.mock("@/lib/server/reservations", () => ({
  createReservation: mocks.createReservation,
  withdrawReservation: mocks.withdrawReservation,
}));

import { POST as apply } from "@/app/(main)/reservations/apply/route";
import { POST as withdraw } from "@/app/(main)/reservations/withdraw/route";

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
    role === null ? null : { id: "u1", name: "山田", role },
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  as("student");
  mocks.createReservation.mockResolvedValue({ kind: "created", id: "r1" });
  mocks.withdrawReservation.mockResolvedValue({ kind: "withdrawn" });
});

describe.each([
  ["/reservations/apply", apply, mocks.createReservation],
  ["/reservations/withdraw", withdraw, mocks.withdrawReservation],
])("%s: 入り口の確認", (path, route, work) => {
  it("同じサイトの画面からだけ受ける(ほかのサイトからは何もしない)", async () => {
    const others: Record<string, string>[] = [
      { "sec-fetch-site": "cross-site", host: HOST },
      { "sec-fetch-site": "same-site", host: HOST },
      { host: HOST },
      { origin: "https://evil.example", host: HOST },
    ];
    for (const headers of others) {
      const response = await route(post(path, { id: "x" }, headers));
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ message: MESSAGES.ME004 });
    }
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

  it("読めない本文は 400、大きすぎる本文は 413", async () => {
    expect((await route(post(path, "{not json"))).status).toBe(400);
    const big = await route(post(path, { id: "x".repeat(20_000) }));
    expect(big.status).toBe(413);
    expect(work).not.toHaveBeenCalled();
  });

  it("応答は保存させない(Cache-Control: no-store)", async () => {
    const response = await route(post(path, { id: "x" }));
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("学生・先生・時間割管理者のだれでも使える", async () => {
    for (const role of ["student", "teacher", "admin"] as const) {
      as(role);
      expect((await route(post(path, { id: "x" }))).status).toBe(200);
    }
  });
});

describe("S06 申請", () => {
  it("できたら MI101 を知らせる。申請者を決めるのは、サーバーだけ", async () => {
    const response = await apply(
      post("/reservations/apply", { applicantId: "someone-else", slots: [5] }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "r1", notice: "MI101" });
    const [user, body] = mocks.createReservation.mock.calls[0];
    // 申請者は、ログイン中の人。本文の値は、使われない(createReservation 側の試験で確かめる)
    expect(user).toEqual({ id: "u1", name: "山田", role: "student" });
    expect(body).toMatchObject({ applicantId: "someone-else" });
  });

  it("確認に通らなければ 400 と、項目ごとの文言", async () => {
    const issues = [
      { code: "ME107", field: "purpose", message: MESSAGES.ME107 },
    ];
    mocks.createReservation.mockResolvedValue({ kind: "invalid", issues });
    const response = await apply(post("/reservations/apply", {}));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ issues });
  });

  it("形が違う入力は 400(中身は返さない)", async () => {
    mocks.createReservation.mockResolvedValue({ kind: "bad_request" });
    const response = await apply(post("/reservations/apply", { x: 1 }));
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).not.toMatch(/zod|issues/i);
  });

  it("内部のエラーは 500 で、中身を出さない", async () => {
    mocks.createReservation.mockRejectedValue(
      new Error("connect ECONNREFUSED postgres://user:pass@host/db"),
    );
    const response = await apply(post("/reservations/apply", {}));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toMatch(
      /postgres|ECONNREFUSED|pass/,
    );
  });
});

describe("S07 取り下げ", () => {
  it("できたら MI102", async () => {
    const response = await withdraw(
      post("/reservations/withdraw", { id: "r1" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ notice: "MI102" });
    expect(mocks.withdrawReservation.mock.calls[0][1]).toBe("r1");
  });

  it("対応済み・期限切れは 409 と ME110", async () => {
    mocks.withdrawReservation.mockResolvedValue({
      kind: "refused",
      message: MESSAGES.ME110,
    });
    const response = await withdraw(
      post("/reservations/withdraw", { id: "r1" }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: MESSAGES.ME110 });
  });

  it("自分の予約でない・存在しないものは 404(どちらか分からない)", async () => {
    mocks.withdrawReservation.mockResolvedValue({ kind: "not_found" });
    const response = await withdraw(
      post("/reservations/withdraw", { id: "r9" }),
    );
    expect(response.status).toBe(404);
  });

  it("id がない本文でも、落ちずに id なしとして扱う", async () => {
    for (const body of [[], null, "x", {}]) {
      await withdraw(post("/reservations/withdraw", body));
    }
    for (const call of mocks.withdrawReservation.mock.calls) {
      expect(call[1]).toBeNull();
    }
  });
});
