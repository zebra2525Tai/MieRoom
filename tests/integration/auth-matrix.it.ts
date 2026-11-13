import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOGIN_ERROR_MESSAGES, MESSAGES } from "@/lib/messages";
import { USERS, type TestRole } from "./support/fixtures";

// T-AUTH: every operation (POST route) by role (テスト設計書 4-1). The sign-in is replaced; the
// handlers, the same-site check and the role rule are the app's own.

vi.mock("server-only", () => ({}));
const session = vi.hoisted(() => ({
  user: null as null | { id: string; name: string; role: TestRole },
}));
vi.mock("@/lib/server/session", async () => {
  const { hasRole } = await import("./support/session");
  return {
    getCurrentUser: async () => session.user,
    hasRole,
    hasFreshSession: async () => true,
  };
});
vi.mock("@/lib/server/db", async () => {
  const { testDb } = await import("./support/db");
  return { getDb: () => testDb() };
});

import { POST as apply } from "@/app/(main)/reservations/apply/route";
import { POST as withdraw } from "@/app/(main)/reservations/withdraw/route";
import { POST as approve } from "@/app/(main)/teacher/reservations/approve/route";
import { POST as reject } from "@/app/(main)/teacher/reservations/reject/route";
import { POST as cancel } from "@/app/(main)/teacher/reservations/cancel/route";
import { POST as proxy } from "@/app/(main)/teacher/reservations/proxy/route";
import { POST as blockCreate } from "@/app/(main)/teacher/blocks/create/route";
import { POST as blockRelease } from "@/app/(main)/teacher/blocks/release/route";
import { POST as importCheck } from "@/app/(main)/admin/import/check/route";
import { POST as importApply } from "@/app/(main)/admin/import/apply/route";
import { POST as importUnlock } from "@/app/(main)/admin/import/unlock/route";
import { POST as exportDownload } from "@/app/(main)/admin/export/download/route";
import { POST as masterSave } from "@/app/(main)/admin/masters/save/route";
import { POST as masterActive } from "@/app/(main)/admin/masters/active/route";
import { POST as linkAdd } from "@/app/(main)/admin/links/add/route";
import { POST as linkRemove } from "@/app/(main)/admin/links/remove/route";
import { POST as closureSave } from "@/app/(main)/admin/closures/save/route";
import { POST as closureDelete } from "@/app/(main)/admin/closures/delete/route";
import { POST as accessTag } from "@/app/(main)/admin/access/tag/route";
import { POST as accessReceiver } from "@/app/(main)/admin/access/receiver/route";
import { POST as accessReceiverRemove } from "@/app/(main)/admin/access/receiver/remove/route";
import { POST as deleteRun } from "@/app/(main)/admin/delete/run/route";
import { POST as monitorAdd } from "@/app/(main)/admin/monitors/add/route";
import { POST as monitorRotate } from "@/app/(main)/admin/monitors/rotate/route";
import { POST as monitorActive } from "@/app/(main)/admin/monitors/active/route";

type Handler = (request: NextRequest) => Promise<Response>;
type Need = "student" | "teacher" | "admin";

const ROUTES: [string, Need, Handler][] = [
  ["/reservations/apply", "student", apply],
  ["/reservations/withdraw", "student", withdraw],
  ["/teacher/reservations/approve", "teacher", approve],
  ["/teacher/reservations/reject", "teacher", reject],
  ["/teacher/reservations/cancel", "teacher", cancel],
  ["/teacher/reservations/proxy", "teacher", proxy],
  ["/teacher/blocks/create", "teacher", blockCreate],
  ["/teacher/blocks/release", "teacher", blockRelease],
  ["/admin/import/check", "admin", importCheck],
  ["/admin/import/apply", "admin", importApply],
  ["/admin/import/unlock", "admin", importUnlock],
  ["/admin/export/download", "admin", exportDownload],
  ["/admin/masters/save", "admin", masterSave],
  ["/admin/masters/active", "admin", masterActive],
  ["/admin/links/add", "admin", linkAdd],
  ["/admin/links/remove", "admin", linkRemove],
  ["/admin/closures/save", "admin", closureSave],
  ["/admin/closures/delete", "admin", closureDelete],
  ["/admin/access/tag", "admin", accessTag],
  ["/admin/access/receiver", "admin", accessReceiver],
  ["/admin/access/receiver/remove", "admin", accessReceiverRemove],
  ["/admin/delete/run", "admin", deleteRun],
  ["/admin/monitors/add", "admin", monitorAdd],
  ["/admin/monitors/rotate", "admin", monitorRotate],
  ["/admin/monitors/active", "admin", monitorActive],
];

const HOST = "mieroom.example";
const RANK: Record<Need, number> = { student: 0, teacher: 1, admin: 2 };

function post(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://${HOST}${path}`, {
    method: "POST",
    headers: {
      host: HOST,
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
      ...headers,
    },
    body: "{}",
  });
}

/** The message of a refusal: the routes answer JSON {message}, the download answers text. */
async function messageOf(response: Response): Promise<string> {
  const text = await response.text();
  try {
    return (JSON.parse(text) as { message?: string }).message ?? text;
  } catch {
    return text;
  }
}

beforeEach(() => {
  session.user = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe.each(ROUTES)("%s (%s 以上)", (path, need, handler) => {
  it("T-AUTH 未ログインは 401(ME005)。何も実行しない", async () => {
    const response = await handler(post(path));
    expect(response.status).toBe(401);
    expect(await messageOf(response)).toBe(LOGIN_ERROR_MESSAGES.ME005);
  });

  it("T-AUTH 別のサイトからは、管理者でも 403(ME004)", async () => {
    session.user = USERS.admin;
    for (const site of ["cross-site", "same-site", "none"]) {
      const response = await handler(post(path, { "sec-fetch-site": site }));
      expect(response.status, site).toBe(403);
      expect(await messageOf(response)).toBe(MESSAGES.ME004);
    }
  });

  it("T-AUTH 役割が足りなければ 403(ME004)、足りれば通る(401・403 にならない)", async () => {
    const people = [
      ["student", USERS.student],
      ["teacher", USERS.teacher],
      ["admin", USERS.admin],
    ] as const;
    for (const [role, user] of people) {
      session.user = user;
      const response = await handler(post(path));
      if (RANK[role] < RANK[need]) {
        expect(response.status, role).toBe(403);
        expect(await messageOf(response), role).toBe(MESSAGES.ME004);
      } else {
        expect([401, 403], role).not.toContain(response.status);
      }
    }
  });
});
