import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MESSAGES, SYSTEM_ERROR_MESSAGE } from "@/lib/messages";

// The three routes of S20 (check, apply, unlock): who may call them and what comes back.
// The session and the import are replaced; the rest is the real route code.

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  runCheck: vi.fn(),
  runApply: vi.fn(),
  unlockException: vi.fn(),
}));
vi.mock("@/lib/server/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
  hasRole: (user: { role: string }, role: string) =>
    role === "admin" ? user.role === "admin" : user.role !== "student",
}));
vi.mock("@/lib/server/timetable-import", () => ({
  runCheck: mocks.runCheck,
  runApply: mocks.runApply,
  unlockException: mocks.unlockException,
}));

import { POST as apply } from "@/app/(main)/admin/import/apply/route";
import { POST as check } from "@/app/(main)/admin/import/check/route";
import { POST as unlock } from "@/app/(main)/admin/import/unlock/route";

const HOST = "mieroom.example";
const SAME = { "sec-fetch-site": "same-origin", host: HOST };

/** A request the way a browser sends it: the body is already encoded and its length is known. */
async function upload(
  url: string,
  form: FormData,
  headers: Record<string, string> = SAME,
) {
  const encoded = new Response(form);
  const body = new Uint8Array(await encoded.arrayBuffer());
  return new NextRequest(`https://${HOST}${url}`, {
    method: "POST",
    body,
    headers: {
      "content-type": encoded.headers.get("content-type")!,
      "content-length": String(body.length),
      ...headers,
    },
  });
}

const csvForm = (...names: string[]) => {
  const form = new FormData();
  for (const name of names) {
    form.append(
      "files",
      new File(["クラス,日付\r\n"], name, { type: "text/csv" }),
    );
  }
  return form;
};

const as = (role: "student" | "teacher" | "admin" | null) =>
  mocks.getCurrentUser.mockResolvedValue(
    role === null ? null : { id: "u1", name: "x", role },
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.runCheck.mockResolvedValue({
    view: { files: [], general: [], ok: true, lostChanges: 0 },
    items: [],
  });
  mocks.runApply.mockResolvedValue({ kind: "invalid", view: { files: [] } });
  mocks.unlockException.mockResolvedValue("unlocked");
});

describe.each([
  ["check", check, "/admin/import/check", () => mocks.runCheck],
  ["apply", apply, "/admin/import/apply", () => mocks.runApply],
] as const)("POST /admin/import/%s", (_name, route, url, work) => {
  it("時間割管理者のファイルを、名前と中身つきで渡す", async () => {
    as("admin");
    const response = await route(await upload(url, csvForm("a.csv", "b.csv")));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const [files] = work().mock.calls[0];
    expect(files.map((f: { name: string }) => f.name)).toEqual([
      "a.csv",
      "b.csv",
    ]);
    expect(new TextDecoder().decode(files[0].bytes)).toBe("クラス,日付\r\n");
  });

  it("別のサイトから、ログインなし、学生・先生は、読む前に断る", async () => {
    for (const [role, headers, status] of [
      ["admin", { ...SAME, "sec-fetch-site": "cross-site" }, 403],
      [null, SAME, 401],
      ["student", SAME, 403],
      ["teacher", SAME, 403],
    ] as const) {
      as(role);
      const response = await route(
        await upload(url, csvForm("a.csv"), headers),
      );
      expect(response.status, `${role}`).toBe(status);
      expect(await response.json()).toEqual({ message: MESSAGES.ME004 });
    }
    expect(work()).not.toHaveBeenCalled();
  });

  it("大きすぎる本文(読む前に長さで判断)は 413、長さがなければ 411", async () => {
    as("admin");
    const big = await upload(url, csvForm("a.csv"), {
      ...SAME,
      "content-length": String(5 * 1024 * 1024),
    });
    expect((await route(big)).status).toBe(413);
    const noLength = new NextRequest(`https://${HOST}${url}`, {
      method: "POST",
      body: "x",
      headers: SAME,
    });
    noLength.headers.delete("content-length");
    expect((await route(noLength)).status).toBe(411);
    expect(work()).not.toHaveBeenCalled();
  });

  it("ファイルがない・ファイルでない値は 400", async () => {
    as("admin");
    expect((await route(await upload(url, new FormData()))).status).toBe(400);
    const text = new FormData();
    text.append("files", "ただの文字");
    expect((await route(await upload(url, text))).status).toBe(400);
    expect(work()).not.toHaveBeenCalled();
  });

  it("失敗しても、内部の情報は出さず ME903 だけ返す", async () => {
    as("admin");
    work().mockRejectedValue(
      new Error("connect ECONNREFUSED ep-secret.neon.tech"),
    );
    const response = await route(await upload(url, csvForm("a.csv")));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ message: SYSTEM_ERROR_MESSAGE });
  });
});

describe("POST /admin/import/apply の応答", () => {
  it("取り込みの結果を、そのまま返す", async () => {
    as("admin");
    mocks.runApply.mockResolvedValue({
      kind: "imported",
      view: { files: [], general: [], ok: true, lostChanges: 0 },
      summary: { months: [{ month: "2026-11", classes: 12, lessons: 531 }] },
    });
    const body = await (
      await apply(await upload("/admin/import/apply", csvForm("a.csv")))
    ).json();
    expect(body.kind).toBe("imported");
    expect(body.summary.months[0]).toEqual({
      month: "2026-11",
      classes: 12,
      lessons: 531,
    });
  });
});

describe("POST /admin/import/unlock", () => {
  const CLASS_ID = "7f1c2d3e-4b5a-4c6d-8e9f-0a1b2c3d4e5f";
  const request = (fields: Record<string, string>, headers = SAME) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    return upload("/admin/import/unlock", form, headers);
  };

  it("クラスと月を渡して解除する", async () => {
    as("admin");
    const response = await unlock(
      await request({ classId: CLASS_ID, month: "2026-11" }),
    );
    expect(response.status).toBe(200);
    expect(mocks.unlockException).toHaveBeenCalledWith(
      CLASS_ID,
      "2026-11",
      expect.any(Date),
    );
  });

  it("形が違う値は 400。解除できない(26日前など)ときも 400", async () => {
    as("admin");
    const bad: Record<string, string>[] = [
      { classId: "not-a-uuid", month: "2026-11" },
      { classId: CLASS_ID, month: "2026-13" },
      { classId: CLASS_ID, month: "202611" },
      { classId: CLASS_ID },
    ];
    for (const fields of bad) {
      expect(
        (await unlock(await request(fields))).status,
        JSON.stringify(fields),
      ).toBe(400);
    }
    expect(mocks.unlockException).not.toHaveBeenCalled();
    mocks.unlockException.mockResolvedValue("not-allowed");
    expect(
      (await unlock(await request({ classId: CLASS_ID, month: "2026-11" })))
        .status,
    ).toBe(400);
  });

  it("別のサイト・ログインなし・管理者でない人は断る", async () => {
    for (const [role, headers, status] of [
      ["admin", { ...SAME, "sec-fetch-site": "same-site" }, 403],
      [null, SAME, 401],
      ["teacher", SAME, 403],
    ] as const) {
      as(role);
      const response = await unlock(
        await request({ classId: CLASS_ID, month: "2026-11" }, headers),
      );
      expect(response.status, `${role}`).toBe(status);
    }
    expect(mocks.unlockException).not.toHaveBeenCalled();
  });
});
