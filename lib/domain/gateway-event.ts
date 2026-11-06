import { z } from "zod";

// 校内PCのゲートウェイから届く、教員位置のイベント (依頼文書「教員位置情報連携 API 要件定義メモ」
// 版1.0, 2026-11-06)。位置の判定 (3回連続で確定、15秒で unknown、60秒で offline) はゲートウェイが
// 行い、ここは確定した変更を受ける。No I/O here.

export const LOCATION_STATUSES = ["detected", "unknown", "offline"] as const;
export type LocationStatusText = (typeof LOCATION_STATUSES)[number];

export const EVENT_TYPES = [
  "teacher_location_changed",
  "teacher_status_changed",
] as const;

/** 1 event; the memo recommends 16 KB at most. */
export const MAX_EVENT_BYTES = 16 * 1024;

/** An event stamped this far ahead of the server clock is taken as "now" (clock drift). */
export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * The body of POST /api/gateway/location-events. A number is a number: "12" is refused.
 * previousRoomId and previousStatus are optional (null on the first fix) and are not used.
 */
export const gatewayEventSchema = z.object({
  eventId: z.uuid(),
  eventType: z.enum(EVENT_TYPES),
  gatewayId: z.string().min(1).max(64),
  // The minor of an iBeacon is 16 bits.
  minor: z.number().int().min(0).max(65535),
  roomId: z.string().min(1).max(64).nullable(),
  previousRoomId: z.string().max(64).nullable().optional(),
  status: z.enum(LOCATION_STATUSES),
  previousStatus: z.enum(LOCATION_STATUSES).nullable().optional(),
  occurredAt: z.iso.datetime({ offset: true }),
});

export type GatewayEvent = z.infer<typeof gatewayEventSchema>;

/**
 * The time the event counts from. A gateway clock that runs ahead must not pin a teacher's
 * position (nothing older could replace it), so a time far in the future becomes `now`.
 */
export function effectiveOccurredAt(occurredAt: Date, now: Date): Date {
  return occurredAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS
    ? now
    : occurredAt;
}

/**
 * Why the event did not change the current position, when it did not. The same event sent
 * again (a lost answer, a retry) is the one the position already came from; anything else
 * that is not newer arrived late (older_event). Neither is an error.
 */
export function whyNotUpdated(
  lastEventId: string | null,
  eventId: string,
): "duplicate" | "older_event" {
  return lastEventId === eventId ? "duplicate" : "older_event";
}

export type LocationView =
  { kind: "room"; room: string } | { kind: "out-of-area" } | { kind: "no-tag" };

/**
 * S05's three states (外部設計書 14-10 #9). No tag registered: 位置情報なし. detected and
 * unknown (the beacon was lost for 15 seconds, not yet 60): the room. offline, or nothing
 * received yet, or a room that is gone: 検知エリア外.
 */
export function teacherLocationView(input: {
  tagId: string | null;
  location: {
    status: "DETECTED" | "UNKNOWN" | "OFFLINE";
    roomName: string | null;
  } | null;
}): LocationView {
  if (input.tagId === null) return { kind: "no-tag" };
  const { location } = input;
  if (
    location === null ||
    location.status === "OFFLINE" ||
    location.roomName === null
  ) {
    return { kind: "out-of-area" };
  }
  return { kind: "room", room: location.roomName };
}
