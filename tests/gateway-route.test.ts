import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_EVENT_BYTES } from "@/lib/domain/gateway-event";

// POST /api/gateway/location-events: the answers of 依頼文書 10, and what is never said.
// The database part is replaced; the route code is the real one.

const KEY = "9f".repeat(32);
const mocks = vi.hoisted(() => ({ apply: vi.fn() }));
vi.mock("@/lib/server/gateway", () => ({
  gatewayConfig: () => ({
    apiKey: "9f".repeat(32),
    gatewayId: "school-pc-001",
  }),
  applyLocationEvent: mocks.apply,
  isDatabaseUnavailable: (error: { code?: string }) => error?.code === "P1001",
}));

import { POST } from "@/app/api/gateway/location-events/route";

const EVENT = {
  eventId: "f22afd6f-57d2-4004-a413-cd51c18b4eec",
  eventType: "teacher_location_changed",
  gatewayId: "school-pc-001",
  minor: 12,
  roomId: "room-102",
  previousRoomId: "room-101",
  status: "detected",
  previousStatus: "detected",
  occurredAt: "2026-11-06T00:30:00.000Z",
};

function call(
  body: unknown = EVENT,
  headers: Record<string, string | null> = {},
) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  const all: Record<string, string | null> = {
    authorization: `Bearer ${KEY}`,
    "x-gateway-id": "school-pc-001",
    "content-type": "application/json",
    "content-length": String(new TextEncoder().encode(text).length),
    ...headers,
  };
  const clean = Object.fromEntries(
    Object.entries(all).filter(([, value]) => value !== null),
  ) as Record<string, string>;
  return POST(
    new NextRequest("https://mieroom.example/api/gateway/location-events", {
      method: "POST",
      body: text,
      headers: clean,
    }),
  );
}

const json = async (response: Response) => response.json();

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.apply.mockResolvedValue({ kind: "updated" });
});

describe("成功(依頼文書 8, 10)", () => {
  it("新しいイベント: 200、duplicate=false、currentLocationUpdated=true", async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await json(response)).toEqual({
      success: true,
      duplicate: false,
      currentLocationUpdated: true,
      eventId: EVENT.eventId,
    });
    expect(mocks.apply).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: EVENT.eventId, minor: 12 }),
      expect.any(Date),
    );
  });

  it("同じイベントの再送: 409 ではなく 200、duplicate=true", async () => {
    mocks.apply.mockResolvedValue({ kind: "duplicate" });
    const response = await call();
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({
      success: true,
      duplicate: true,
      eventId: EVENT.eventId,
    });
  });

  it("古いイベント: 200、currentLocationUpdated=false、reason=older_event", async () => {
    mocks.apply.mockResolvedValue({ kind: "older_event" });
    expect(await json(await call())).toEqual({
      success: true,
      duplicate: false,
      currentLocationUpdated: false,
      reason: "older_event",
      eventId: EVENT.eventId,
    });
  });

  it("未登録の教員・教室: 送り直しても無駄なので、エラーにせず 200(理由つき)", async () => {
    for (const reason of ["unknown_teacher", "unknown_room"] as const) {
      mocks.apply.mockResolvedValue({ kind: "ignored", reason });
      const response = await call();
      expect(response.status, reason).toBe(200);
      expect(await json(response)).toMatchObject({
        success: true,
        currentLocationUpdated: false,
        reason,
      });
    }
  });

  it("状態変更のイベント(6.2)も受け付ける", async () => {
    const response = await call({
      eventId: "3d32d92c-8fd2-462b-a8f6-45bbcbd81beb",
      eventType: "teacher_status_changed",
      gatewayId: "school-pc-001",
      minor: 12,
      roomId: "room-101",
      status: "unknown",
      previousStatus: "detected",
      occurredAt: "2026-11-06T00:31:15.000Z",
    });
    expect(response.status).toBe(200);
    expect(mocks.apply.mock.calls[0][0]).toMatchObject({
      status: "unknown",
      eventType: "teacher_status_changed",
    });
  });
});

describe("認証(依頼文書 5): 通る前は、何も読まず、何も書かない", () => {
  const unauthorized = { success: false, error: "unauthorized" };

  it("Authorization なし・キー違い・形式違いは 401。キーの正誤は分からない", async () => {
    for (const headers of [
      { authorization: null },
      { authorization: `Bearer ${"0".repeat(64)}` },
      { authorization: KEY },
      { authorization: `Basic ${KEY}` },
    ]) {
      const response = await call(EVENT, headers);
      expect(response.status, JSON.stringify(headers)).toBe(401);
      expect(await json(response)).toEqual(unauthorized);
    }
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it("X-Gateway-ID がない・登録と違う: 401", async () => {
    expect((await call(EVENT, { "x-gateway-id": null })).status).toBe(401);
    expect((await call(EVENT, { "x-gateway-id": "other-pc" })).status).toBe(
      401,
    );
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it("認証に通らなければ、本文が不正でも 401(本文の誤りは教えない)", async () => {
    expect((await call("{not json", { authorization: null })).status).toBe(401);
    expect((await call({}, { authorization: null })).status).toBe(401);
  });
});

describe("本文(依頼文書 7, 10)", () => {
  it("JSON でない: 400 invalid_json", async () => {
    const response = await call("{not json");
    expect(response.status).toBe(400);
    expect(await json(response)).toEqual({
      success: false,
      error: "invalid_json",
    });
  });

  it("項目・型の誤り: 400 invalid_request_body(minor が文字列、必須なし、許可されない値)", async () => {
    for (const body of [
      { ...EVENT, minor: "12" },
      { ...EVENT, status: "online" },
      { ...EVENT, eventId: "x" },
      {},
      [],
      "null",
    ]) {
      const response = await call(body);
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(await json(response)).toEqual({
        success: false,
        error: "invalid_request_body",
      });
    }
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it("Content-Type が application/json でない: 400", async () => {
    expect((await call(EVENT, { "content-type": "text/plain" })).status).toBe(
      400,
    );
    expect((await call(EVENT, { "content-type": null })).status).toBe(400);
  });

  it("ヘッダーと本文の gatewayId が違う: 400 gateway_id_mismatch", async () => {
    const response = await call({ ...EVENT, gatewayId: "school-pc-002" });
    expect(response.status).toBe(400);
    expect(await json(response)).toEqual({
      success: false,
      error: "gateway_id_mismatch",
    });
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it("16KB を超える: 413 payload_too_large(長さの申告でも、実際の大きさでも)", async () => {
    const big = JSON.stringify({
      ...EVENT,
      padding: "x".repeat(MAX_EVENT_BYTES),
    });
    const response = await call(big);
    expect(response.status).toBe(413);
    expect(await json(response)).toEqual({
      success: false,
      error: "payload_too_large",
    });
    const lied = await call(EVENT, {
      "content-length": String(MAX_EVENT_BYTES + 1),
    });
    expect(lied.status).toBe(413);
    const understated = await call(big, { "content-length": "10" });
    expect(understated.status).toBe(413);
    expect(mocks.apply).not.toHaveBeenCalled();
  });
});

describe("保存の失敗(依頼文書 10)", () => {
  it("DB につながらない: 503 database_unavailable(送り直してよい)", async () => {
    mocks.apply.mockRejectedValue(
      Object.assign(new Error("can't reach ep-secret.neon.tech"), {
        code: "P1001",
      }),
    );
    const response = await call();
    expect(response.status).toBe(503);
    expect(await json(response)).toEqual({
      success: false,
      error: "database_unavailable",
    });
  });

  it("そのほかの失敗: 500 internal_server_error。内部の情報は返さず、ログにも出さない", async () => {
    mocks.apply.mockRejectedValue(
      new Error(
        "select * from locations failed at postgres://user:secret@ep-host/db",
      ),
    );
    const response = await call();
    expect(response.status).toBe(500);
    const text = JSON.stringify(await json(response));
    expect(text).toBe(
      JSON.stringify({ success: false, error: "internal_server_error" }),
    );
    const logged = JSON.stringify([
      ...vi.mocked(console.error).mock.calls,
      ...vi.mocked(console.info).mock.calls,
    ]);
    expect(logged).not.toContain("secret");
    expect(logged).not.toContain("postgres://");
  });
});

describe("ログ(依頼文書 12.1): 鍵と Authorization は出さない", () => {
  it("1回の受信で1行。eventId・gatewayId・種別・状態・結果・時間・HTTPステータス。鍵・教員・教室は出さない", async () => {
    await call();
    const lines = vi.mocked(console.info).mock.calls.map((c) => String(c[0]));
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry).toMatchObject({
      eventId: EVENT.eventId,
      gatewayId: "school-pc-001",
      eventType: "teacher_location_changed",
      status: 200,
      outcome: "updated",
    });
    expect(typeof entry.ms).toBe("number");
    expect(lines[0]).not.toContain(KEY);
    expect(lines[0].toLowerCase()).not.toContain("authorization");
    expect(lines[0]).not.toContain("room-102");
    expect(lines[0]).not.toContain('"minor"');
  });

  it("認証に失敗した受信でも、鍵(送られたもの)をログに出さない", async () => {
    const wrong = "0".repeat(64);
    await call(EVENT, { authorization: `Bearer ${wrong}` });
    const logged = JSON.stringify(vi.mocked(console.info).mock.calls);
    expect(logged).not.toContain(wrong);
    expect(logged).not.toContain(KEY);
  });
});
