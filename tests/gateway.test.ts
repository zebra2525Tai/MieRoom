import { describe, expect, it } from "vitest";
import {
  effectiveOccurredAt,
  FUTURE_TOLERANCE_MS,
  gatewayEventSchema,
  teacherLocationView,
  whyNotUpdated,
} from "@/lib/domain/gateway-event";
import { authenticateGateway } from "@/lib/server/gateway-auth";

// 依頼文書の例そのまま (6.1)
const LOCATION_EVENT = {
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
// 6.2
const STATUS_EVENT = {
  eventId: "3d32d92c-8fd2-462b-a8f6-45bbcbd81beb",
  eventType: "teacher_status_changed",
  gatewayId: "school-pc-001",
  minor: 12,
  roomId: "room-101",
  status: "unknown",
  previousStatus: "detected",
  occurredAt: "2026-11-06T00:31:15.000Z",
};

const valid = (body: unknown) => gatewayEventSchema.safeParse(body).success;
const without = (key: string) => {
  const copy: Record<string, unknown> = { ...LOCATION_EVENT };
  delete copy[key];
  return copy;
};

describe("gatewayEventSchema (依頼文書 6, 7)", () => {
  it("文書の2つの例を受け付ける", () => {
    expect(valid(LOCATION_EVENT)).toBe(true);
    expect(valid(STATUS_EVENT)).toBe(true);
  });

  it("初回の位置確定(previousRoomId が null)と、previous の省略を受け付ける", () => {
    expect(
      valid({ ...LOCATION_EVENT, previousRoomId: null, previousStatus: null }),
    ).toBe(true);
    expect(valid(without("previousRoomId"))).toBe(true);
    expect(valid(without("previousStatus"))).toBe(true);
  });

  it("roomId は文字列か null。省略は不可", () => {
    expect(valid({ ...LOCATION_EVENT, roomId: null })).toBe(true);
    expect(valid(without("roomId"))).toBe(false);
    expect(valid({ ...LOCATION_EVENT, roomId: 101 })).toBe(false);
    expect(valid({ ...LOCATION_EVENT, roomId: "" })).toBe(false);
  });

  it('minor は0以上の整数。文字列の "12"、負の数、小数、16ビットを超える値は拒否', () => {
    for (const minor of ["12", -1, 1.5, 65536, null, undefined, NaN]) {
      expect(valid({ ...LOCATION_EVENT, minor }), String(minor)).toBe(false);
    }
    expect(valid({ ...LOCATION_EVENT, minor: 0 })).toBe(true);
    expect(valid({ ...LOCATION_EVENT, minor: 65535 })).toBe(true);
  });

  it("必須の項目がなければ拒否", () => {
    for (const key of [
      "eventId",
      "eventType",
      "gatewayId",
      "minor",
      "status",
      "occurredAt",
    ]) {
      expect(valid(without(key)), key).toBe(false);
    }
  });

  it("eventId は UUID。eventType と status は許可された値だけ", () => {
    expect(valid({ ...LOCATION_EVENT, eventId: "not-a-uuid" })).toBe(false);
    expect(valid({ ...LOCATION_EVENT, eventType: "teacher_moved" })).toBe(
      false,
    );
    for (const status of ["detected", "unknown", "offline"]) {
      expect(valid({ ...LOCATION_EVENT, status }), status).toBe(true);
    }
    for (const status of ["DETECTED", "online", "", null]) {
      expect(valid({ ...LOCATION_EVENT, status }), String(status)).toBe(false);
    }
  });

  it("occurredAt は ISO 8601。日時として読めないものは拒否", () => {
    expect(
      valid({ ...LOCATION_EVENT, occurredAt: "2026-11-06T09:30:00+09:00" }),
    ).toBe(true);
    for (const occurredAt of [
      "yesterday",
      "2026-11-06",
      "2026-13-40T00:00:00Z",
      1788660600000,
      "",
    ]) {
      expect(valid({ ...LOCATION_EVENT, occurredAt }), String(occurredAt)).toBe(
        false,
      );
    }
  });

  it("gatewayId は空文字不可", () => {
    expect(valid({ ...LOCATION_EVENT, gatewayId: "" })).toBe(false);
  });

  it("本文がオブジェクトでなければ拒否", () => {
    for (const body of [null, [], "text", 12, [LOCATION_EVENT]]) {
      expect(valid(body)).toBe(false);
    }
  });
});

describe("effectiveOccurredAt", () => {
  const now = new Date("2026-11-06T00:30:00.000Z");

  it("普通の時刻は、そのまま", () => {
    expect(effectiveOccurredAt(new Date("2026-11-06T00:29:00Z"), now)).toEqual(
      new Date("2026-11-06T00:29:00Z"),
    );
    expect(effectiveOccurredAt(new Date("2026-11-05T00:00:00Z"), now)).toEqual(
      new Date("2026-11-05T00:00:00Z"),
    );
  });

  it("5分までの先走りは許す。それより先の時刻は、いまにする(位置が固定されないように)", () => {
    const edge = new Date(now.getTime() + FUTURE_TOLERANCE_MS);
    expect(effectiveOccurredAt(edge, now)).toEqual(edge);
    expect(effectiveOccurredAt(new Date(edge.getTime() + 1), now)).toEqual(now);
    expect(effectiveOccurredAt(new Date("2099-01-01T00:00:00Z"), now)).toEqual(
      now,
    );
  });
});

describe("whyNotUpdated", () => {
  const id = "f22afd6f-57d2-4004-a413-cd51c18b4eec";
  it("いまの位置の元になったイベントの再送は duplicate。ほかは older_event", () => {
    expect(whyNotUpdated(id, id)).toBe("duplicate");
    expect(whyNotUpdated("3d32d92c-8fd2-462b-a8f6-45bbcbd81beb", id)).toBe(
      "older_event",
    );
    expect(whyNotUpdated(null, id)).toBe("older_event");
  });
});

describe("teacherLocationView (S05 の3状態、14-10 #9)", () => {
  const at = (
    status: "DETECTED" | "UNKNOWN" | "OFFLINE",
    roomName: string | null = "304",
  ) => ({ status, roomName });

  it("タグが登録されていなければ、位置情報なし(位置があっても)", () => {
    expect(teacherLocationView({ tagId: null, location: null })).toEqual({
      kind: "no-tag",
    });
    expect(
      teacherLocationView({ tagId: null, location: at("DETECTED") }),
    ).toEqual({ kind: "no-tag" });
  });

  it("detected と unknown は教室名。offline は検知エリア外", () => {
    expect(
      teacherLocationView({ tagId: "12", location: at("DETECTED") }),
    ).toEqual({ kind: "room", room: "304" });
    expect(
      teacherLocationView({ tagId: "12", location: at("UNKNOWN") }),
    ).toEqual({ kind: "room", room: "304" });
    expect(
      teacherLocationView({ tagId: "12", location: at("OFFLINE") }),
    ).toEqual({ kind: "out-of-area" });
  });

  it("まだ何も届いていない、または教室がなくなった: 検知エリア外", () => {
    expect(teacherLocationView({ tagId: "12", location: null })).toEqual({
      kind: "out-of-area",
    });
    expect(
      teacherLocationView({ tagId: "12", location: at("DETECTED", null) }),
    ).toEqual({ kind: "out-of-area" });
  });
});

describe("authenticateGateway (依頼文書 5)", () => {
  const KEY = "a".repeat(64);
  const config = { apiKey: KEY, gatewayId: "school-pc-001" };
  const headers = (over: Record<string, string> = {}) =>
    new Headers({
      authorization: `Bearer ${KEY}`,
      "x-gateway-id": "school-pc-001",
      ...over,
    });

  it("正しいキーと gatewayId なら通る", () => {
    expect(authenticateGateway(headers(), config)).toBe("ok");
  });

  it("Authorization がない・Bearer でない・キーが違うは unauthorized", () => {
    const noAuth = headers();
    noAuth.delete("authorization");
    expect(authenticateGateway(noAuth, config)).toBe("unauthorized");
    for (const authorization of [
      KEY,
      `Basic ${KEY}`,
      `Bearer ${"b".repeat(64)}`,
      `Bearer ${KEY.slice(0, 63)}`,
      `Bearer ${KEY}x`,
      "Bearer",
      "Bearer  ",
      `bearer ${KEY}`,
    ]) {
      expect(
        authenticateGateway(headers({ authorization }), config),
        authorization,
      ).toBe("unauthorized");
    }
  });

  it("X-Gateway-ID がない・違うは unauthorized(キーが正しくても)", () => {
    const noId = headers();
    noId.delete("x-gateway-id");
    expect(authenticateGateway(noId, config)).toBe("unauthorized");
    expect(
      authenticateGateway(headers({ "x-gateway-id": "other-pc" }), config),
    ).toBe("unauthorized");
  });

  it("キーか gatewayId が設定されていなければ disabled(送る人の値は見ない)", () => {
    expect(authenticateGateway(headers(), { ...config, apiKey: "" })).toBe(
      "disabled",
    );
    expect(authenticateGateway(headers(), { ...config, gatewayId: "" })).toBe(
      "disabled",
    );
    expect(
      authenticateGateway(new Headers(), { apiKey: "", gatewayId: "" }),
    ).toBe("disabled");
  });
});
