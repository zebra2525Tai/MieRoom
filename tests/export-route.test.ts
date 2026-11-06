import { NextRequest } from "next/server";
import { unzipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MASTER_FILES } from "@/lib/domain/master-csv";
import { SYSTEM_ERROR_MESSAGE } from "@/lib/messages";
import { demoSource } from "./support/master-source";

// The download of S24 (POST /admin/export/download): who may call it, and what comes back.
// The session and the database are replaced; the rest is the real handler.

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  loadExportSource: vi.fn(),
}));
vi.mock("@/lib/server/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
  hasRole: (user: { role: string }, role: string) =>
    role === "admin" ? user.role === "admin" : user.role !== "student",
}));
vi.mock("@/lib/server/queries/export", () => ({
  loadExportSource: mocks.loadExportSource,
}));

import { POST } from "@/app/(main)/admin/export/download/route";

const HOST = "mieroom.example";

function request(headers: Record<string, string> = {}) {
  return new NextRequest(`https://${HOST}/admin/export/download`, {
    method: "POST",
    headers: { host: HOST, origin: `https://${HOST}`, ...headers },
  });
}

const as = (role: "student" | "teacher" | "admin") =>
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "x", role });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadExportSource.mockResolvedValue(demoSource());
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /admin/export/download", () => {
  it("時間割管理者には、8つのCSVが入った ZIP を返す", async () => {
    as("admin");
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const disposition = response.headers.get("content-disposition") ?? "";
    expect(disposition).toMatch(
      /^attachment; filename="mieroom_masters_\d{8}\.zip"; filename\*=UTF-8''%E3%83%9F%E3%82%A8%E3%83%AB%E3%83%BC%E3%83%A0_%E3%83%9E%E3%82%B9%E3%82%BF_\d{8}\.zip$/,
    );
    const body = new Uint8Array(await response.arrayBuffer());
    expect(Number(response.headers.get("content-length"))).toBe(body.length);
    expect(Object.keys(unzipSync(body)).sort()).toEqual(
      Object.values(MASTER_FILES).sort(),
    );
  });

  it("書き出し前の確認に引っかかれば、ZIP は返さず 409(ME510)", async () => {
    as("admin");
    const source = demoSource();
    source.classes[0].teachers.pop();
    mocks.loadExportSource.mockResolvedValue(source);
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(await response.text()).toBe(
      "書き出し前の確認で、直す必要があるものがあります(1件)。直してから書き出してください。",
    );
  });

  it("学生・先生は 403。DB は読まない", async () => {
    for (const role of ["student", "teacher"] as const) {
      as(role);
      const response = await POST(request());
      expect(response.status, role).toBe(403);
    }
    expect(mocks.loadExportSource).not.toHaveBeenCalled();
  });

  it("ログインしていなければ 401。DB は読まない", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.loadExportSource).not.toHaveBeenCalled();
  });

  it("別のサイトから(Origin が違う)、または Origin がなければ 403。ログインの確認より先", async () => {
    as("admin");
    for (const headers of [
      { origin: "https://evil.example" },
      { origin: "null" },
      { origin: `http://${HOST}.evil.example` },
    ]) {
      expect((await POST(request(headers))).status, headers.origin).toBe(403);
    }
    const noOrigin = new NextRequest(`https://${HOST}/admin/export/download`, {
      method: "POST",
      headers: { host: HOST },
    });
    expect((await POST(noOrigin)).status).toBe(403);
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
    expect(mocks.loadExportSource).not.toHaveBeenCalled();
  });

  it("DB で失敗しても、内部の情報は出さず ME903 だけ返す", async () => {
    as("admin");
    mocks.loadExportSource.mockRejectedValue(
      new Error("connect ECONNREFUSED ep-secret-host.neon.tech"),
    );
    const response = await POST(request());
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).toBe(SYSTEM_ERROR_MESSAGE);
    expect(text).not.toContain("neon");
  });
});
