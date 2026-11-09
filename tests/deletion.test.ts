import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  describeDeletion,
  nameMatches,
  type DeletionCounts,
} from "@/lib/domain/deletion";
import { isFreshSession } from "@/lib/auth/policy";
import { LOGIN_ERROR_MESSAGES, MESSAGES } from "@/lib/messages";

// S26 削除管理: what keeps a master from being deleted, the deletion itself, and the entry point.

vi.mock("server-only", () => ({}));
const tx = vi.hoisted(() => ({
  schoolClass: { findUnique: vi.fn(), deleteMany: vi.fn() },
  subject: { findUnique: vi.fn(), deleteMany: vi.fn() },
  room: { findUnique: vi.fn(), deleteMany: vi.fn() },
  teacher: { findUnique: vi.fn(), deleteMany: vi.fn() },
}));
const usage = vi.hoisted(() => ({ countUsage: vi.fn() }));
const db = vi.hoisted(() => ({ $transaction: vi.fn() }));
vi.mock("@/lib/server/db", () => ({ getDb: () => db }));
vi.mock("@/lib/server/queries/deletion", () => ({
  countUsage: usage.countUsage,
}));
const session = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  hasFreshSession: vi.fn(),
}));
vi.mock("@/lib/server/session", () => ({
  getCurrentUser: session.getCurrentUser,
  hasFreshSession: session.hasFreshSession,
  hasRole: (user: { role: string }, role: string) =>
    role === "admin"
      ? user.role === "admin"
      : role === "teacher"
        ? user.role !== "student"
        : true,
}));

import { POST as runRoute } from "@/app/(main)/admin/delete/run/route";
import { deleteMaster } from "@/lib/server/deletion";

const ID = "5b0f2f3a-8a4e-4a39-8a5c-1e6a0a1d3b11";
const NOW = new Date("2026-11-10T00:00:00Z");

const counts = (over: Partial<DeletionCounts> = {}): DeletionCounts => ({
  futureLessons: 0,
  pastLessons: 0,
  links: 0,
  validReservations: 0,
  finishedReservations: 0,
  activeBlocks: 0,
  finishedBlocks: 0,
  receivers: 0,
  homeroomClasses: [],
  monthStatuses: 0,
  classClosures: 0,
  hasTag: false,
  hasLocation: false,
  ...over,
});

describe("使われている理由 (R5-7)", () => {
  it("使われていなければ、理由なし(削除できる)", () => {
    for (const kind of ["classes", "subjects", "teachers", "rooms"] as const) {
      expect(describeDeletion(kind, counts()).reasons, kind).toEqual([]);
    }
  });

  it("今日以降の授業は、どの種類でも理由になる。過去の授業は理由にならない", () => {
    for (const kind of ["classes", "subjects", "teachers", "rooms"] as const) {
      expect(
        describeDeletion(kind, counts({ futureLessons: 3 })).reasons,
      ).toEqual(["今日以降の授業3件"]);
      expect(
        describeDeletion(kind, counts({ pastLessons: 99 })).reasons,
      ).toEqual([]);
    }
  });

  it("紐づけは、教科・講師・教室の理由。クラスは自分の紐づけを一緒に消すので理由にならない", () => {
    for (const kind of ["subjects", "teachers", "rooms"] as const) {
      expect(describeDeletion(kind, counts({ links: 2 })).reasons).toEqual([
        "紐づけ2件",
      ]);
    }
    expect(describeDeletion("classes", counts({ links: 2 })).reasons).toEqual(
      [],
    );
  });

  it("教室だけ: 有効な予約、終わっていない使用止め、ホームルーム教室(終わったクラスも)", () => {
    const reasons = describeDeletion(
      "rooms",
      counts({
        validReservations: 2,
        activeBlocks: 1,
        homeroomClasses: ["旧クラスA", "クラスB"],
      }),
    ).reasons;
    expect(reasons).toEqual([
      "有効な予約2件",
      "使用止め1件",
      "ホームルーム教室(旧クラスA、クラスB)",
    ]);
    for (const kind of ["classes", "subjects", "teachers"] as const) {
      expect(
        describeDeletion(
          kind,
          counts({
            validReservations: 2,
            activeBlocks: 1,
            homeroomClasses: ["A"],
          }),
        ).reasons,
      ).toEqual([]);
    }
  });

  it("終わった予約・使用止めは理由にならない(一緒に消える)", () => {
    expect(
      describeDeletion(
        "rooms",
        counts({ finishedReservations: 5, finishedBlocks: 2 }),
      ).reasons,
    ).toEqual([]);
  });
});

describe("削除したときの影響", () => {
  it("クラス: 過去の授業も消える。取り込みの状況と、クラスごとの休み・行事も", () => {
    expect(
      describeDeletion(
        "classes",
        counts({ pastLessons: 40, monthStatuses: 3, classClosures: 2 }),
      ).impacts,
    ).toEqual([
      "過去の授業40件も消える",
      "取り込みの状況3件も消える",
      "クラスごとの休み・行事2件も消える",
    ]);
  });
  it("教科: 過去の授業は名前だけ残る", () => {
    expect(
      describeDeletion("subjects", counts({ pastLessons: 12 })).impacts,
    ).toEqual(["過去の授業12件は名前だけ残る"]);
  });
  it("講師: 位置とタグも消える。その人は先生ではなくなる", () => {
    const impacts = describeDeletion(
      "teachers",
      counts({ pastLessons: 5, hasTag: true, hasLocation: true }),
    ).impacts;
    expect(impacts).toEqual([
      "過去の授業5件は名前だけ残る",
      "位置とタグも消える。その人は先生ではなくなる",
    ]);
    expect(describeDeletion("teachers", counts()).impacts[1]).toContain(
      "先生ではなくなる",
    );
  });
  it("教室: 終わった予約・使用止めも一緒に消える。受信機の登録も", () => {
    expect(
      describeDeletion(
        "rooms",
        counts({
          pastLessons: 8,
          finishedReservations: 3,
          finishedBlocks: 1,
          receivers: 2,
        }),
      ).impacts,
    ).toEqual([
      "過去の授業8件は名前だけ残る",
      "終わった予約3件・終わった使用止め1件も一緒に消える",
      "受信機の登録2件も消える",
    ]);
  });
});

describe("名前の入力 (R5-7 4)", () => {
  it("書かれた名前と同じでなければならない。前後の空白だけ許す", () => {
    expect(nameMatches("旧展示室", "旧展示室")).toBe(true);
    expect(nameMatches("  旧展示室 ", "旧展示室")).toBe(true);
    for (const typed of [
      "旧展示",
      "旧展示室2",
      "",
      " ",
      "旧 展示室",
      undefined,
      null,
      5,
      {},
    ]) {
      expect(nameMatches(typed, "旧展示室"), String(typed)).toBe(false);
    }
  });
  it("全角と半角は同じにしない(別の名前)", () => {
    expect(nameMatches("３０４", "304")).toBe(false);
  });
});

describe("再認証 (3-4)", () => {
  it("5分以内にログインし直していること。ちょうど5分は古い", () => {
    const signedIn = new Date("2026-11-10T00:00:00Z");
    expect(isFreshSession(signedIn, new Date("2026-11-10T00:04:59Z"))).toBe(
      true,
    );
    expect(isFreshSession(signedIn, new Date("2026-11-10T00:05:00Z"))).toBe(
      false,
    );
    expect(isFreshSession(signedIn, new Date("2026-11-09T23:59:59Z"))).toBe(
      false,
    );
  });
});

describe("deleteMaster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation((work: (t: typeof tx) => unknown) =>
      work(tx),
    );
    for (const table of [tx.schoolClass, tx.subject, tx.room]) {
      table.findUnique.mockResolvedValue({ name: "旧展示室", active: false });
      table.deleteMany.mockResolvedValue({ count: 1 });
    }
    tx.teacher.findUnique.mockResolvedValue({
      displayName: "旧展示室",
      active: false,
    });
    tx.teacher.deleteMany.mockResolvedValue({ count: 1 });
    usage.countUsage.mockResolvedValue(counts());
  });

  it("無効で、名前が合い、使われていなければ消す。無効のままの行だけ", async () => {
    expect(await deleteMaster("rooms", ID, "旧展示室", NOW)).toEqual({
      kind: "deleted",
    });
    expect(tx.room.deleteMany).toHaveBeenCalledWith({
      where: { id: ID, active: false },
    });
    for (const kind of ["classes", "subjects", "teachers"] as const) {
      expect(await deleteMaster(kind, ID, "旧展示室", NOW)).toEqual({
        kind: "deleted",
      });
    }
  });

  it("有効なままのものは消さない(先に無効にする)", async () => {
    tx.room.findUnique.mockResolvedValue({ name: "旧展示室", active: true });
    const result = await deleteMaster("rooms", ID, "旧展示室", NOW);
    expect(result).toMatchObject({ kind: "refused" });
    expect(tx.room.deleteMany).not.toHaveBeenCalled();
  });

  it("名前が違えば ME511。使用の確認にも進まない", async () => {
    expect(await deleteMaster("rooms", ID, "旧展示", NOW)).toEqual({
      kind: "refused",
      message: MESSAGES.ME511,
    });
    expect(usage.countUsage).not.toHaveBeenCalled();
    expect(tx.room.deleteMany).not.toHaveBeenCalled();
  });

  it("使われていたら ME512(理由つき)。消さない — トランザクションの中で読み直した結果で", async () => {
    usage.countUsage.mockResolvedValue(
      counts({ futureLessons: 2, homeroomClasses: ["A組"] }),
    );
    expect(await deleteMaster("rooms", ID, "旧展示室", NOW)).toEqual({
      kind: "refused",
      message: MESSAGES.ME512("今日以降の授業2件、ホームルーム教室(A組)"),
    });
    expect(tx.room.deleteMany).not.toHaveBeenCalled();
    // 読み直しは、消すのと同じトランザクションの道具(tx)で行う
    expect(usage.countUsage.mock.calls[0][0]).toBe(tx);
  });

  it("確認と削除のあいだに使われ始めたら、DBの外部キーが断る → ME512", async () => {
    tx.room.deleteMany.mockRejectedValue(
      Object.assign(new Error("fk"), { code: "P2003" }),
    );
    expect(await deleteMaster("rooms", ID, "旧展示室", NOW)).toMatchObject({
      kind: "refused",
    });
    tx.room.deleteMany.mockRejectedValue(new Error("connection lost"));
    await expect(deleteMaster("rooms", ID, "旧展示室", NOW)).rejects.toThrow(
      "connection lost",
    );
  });

  it("確認のあと、ほかで有効に戻されていたら消えない(0件 → not_found)", async () => {
    tx.room.deleteMany.mockResolvedValue({ count: 0 });
    expect(await deleteMaster("rooms", ID, "旧展示室", NOW)).toEqual({
      kind: "not_found",
    });
  });

  it("行がなければ not_found。種類・IDの形が違えば DB に触らない", async () => {
    tx.room.findUnique.mockResolvedValue(null);
    expect(await deleteMaster("rooms", ID, "旧展示室", NOW)).toEqual({
      kind: "not_found",
    });
    db.$transaction.mockClear();
    for (const [kind, id] of [
      ["unknown", ID],
      ["rooms", "x' OR 1=1"],
      [undefined, ID],
      ["rooms", undefined],
    ] as const) {
      expect(await deleteMaster(kind, id, "x", NOW)).toEqual({
        kind: "not_found",
      });
    }
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("S26 の入り口", () => {
  const HOST = "mieroom.example";
  const SAME = { "sec-fetch-site": "same-origin", host: HOST };
  const post = (body: unknown, headers: Record<string, string> = SAME) =>
    new NextRequest(`https://${HOST}/admin/delete/run`, {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "content-type": "application/json", ...headers },
    });
  const as = (role: "student" | "teacher" | "admin" | null) =>
    session.getCurrentUser.mockResolvedValue(
      role === null ? null : { id: "u1", name: "管理者", role },
    );
  const body = { kind: "rooms", id: ID, name: "旧展示室" };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    as("admin");
    session.hasFreshSession.mockResolvedValue(true);
    db.$transaction.mockImplementation((work: (t: typeof tx) => unknown) =>
      work(tx),
    );
    tx.room.findUnique.mockResolvedValue({ name: "旧展示室", active: false });
    tx.room.deleteMany.mockResolvedValue({ count: 1 });
    usage.countUsage.mockResolvedValue(counts());
  });

  it("時間割管理者だけ。先生・学生は 403、ログインなしは 401。何もしない", async () => {
    for (const role of ["student", "teacher"] as const) {
      as(role);
      const response = await runRoute(post(body));
      expect(response.status, role).toBe(403);
      expect(await response.json()).toEqual({ message: MESSAGES.ME004 });
    }
    as(null);
    const none = await runRoute(post(body));
    expect(none.status).toBe(401);
    expect(await none.json()).toEqual({ message: LOGIN_ERROR_MESSAGES.ME005 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("同じサイトの画面からだけ", async () => {
    const others: Record<string, string>[] = [
      { "sec-fetch-site": "cross-site", host: HOST },
      { host: HOST },
      { origin: "https://evil.example", host: HOST },
    ];
    for (const headers of others) {
      expect((await runRoute(post(body, headers))).status).toBe(403);
    }
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("5分以内にログインし直していなければ 403 と ME006(reauth)。何もしない", async () => {
    session.hasFreshSession.mockResolvedValue(false);
    const response = await runRoute(post(body));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      message: LOGIN_ERROR_MESSAGES.ME006,
      reauth: true,
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("できたら 200 と MI503。応答は保存させない", async () => {
    const response = await runRoute(post(body));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ notice: "MI503" });
  });

  it("名前が違う・使われている: 409 と文言。行がない: 404 と ME902", async () => {
    const wrong = await runRoute(post({ ...body, name: "違う" }));
    expect(wrong.status).toBe(409);
    expect(await wrong.json()).toEqual({ message: MESSAGES.ME511 });
    tx.room.findUnique.mockResolvedValue(null);
    const gone = await runRoute(post(body));
    expect(gone.status).toBe(404);
    expect(await gone.json()).toEqual({ message: MESSAGES.ME902 });
  });

  it("読めない本文は 400。内部のエラーは 500 で、中身を出さない", async () => {
    expect((await runRoute(post("{nope"))).status).toBe(400);
    db.$transaction.mockRejectedValue(new Error("postgres://u:p@h/db"));
    const response = await runRoute(post(body));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toMatch(/postgres|:p@/);
  });
});
