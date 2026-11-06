import "server-only";
import {
  effectiveOccurredAt,
  whyNotUpdated,
  type GatewayEvent,
} from "@/lib/domain/gateway-event";
import { getDb } from "./db";
import { getEnv } from "./env";
import type { GatewayConfig } from "./gateway-auth";

// 教員位置の保存 (外部設計書 R7, E17). The caller has already checked the gateway's key.

export function gatewayConfig(): GatewayConfig {
  const env = getEnv();
  return { apiKey: env.GATEWAY_API_KEY, gatewayId: env.ALLOWED_GATEWAY_ID };
}

export type LocationOutcome =
  | { kind: "updated" }
  | { kind: "duplicate" }
  | { kind: "older_event" }
  /** Not an error: sending it again would not help, so the gateway is told "accepted". */
  | { kind: "ignored"; reason: "unknown_teacher" | "unknown_room" };

const STATUS = {
  detected: "DETECTED",
  unknown: "UNKNOWN",
  offline: "OFFLINE",
} as const;

/**
 * The minor is the 講師's タグID (S25) and the gateway's roomId is a 受信機ID of a room
 * (S25). Only the latest position is kept (12章): the row is written in one statement that
 * changes it only when the event is newer, so a late event cannot move a teacher back and
 * two events at once cannot both win.
 */
export async function applyLocationEvent(
  event: GatewayEvent,
  now: Date,
): Promise<LocationOutcome> {
  const db = getDb();
  const [teacher, receiver] = await Promise.all([
    db.teacher.findFirst({
      where: { tagId: String(event.minor), active: true },
      select: { id: true },
    }),
    event.roomId === null
      ? Promise.resolve(null)
      : db.receiver.findUnique({
          where: { receiverId: event.roomId },
          select: { roomId: true },
        }),
  ]);
  if (teacher === null) return { kind: "ignored", reason: "unknown_teacher" };
  if (event.roomId !== null && receiver === null) {
    return { kind: "ignored", reason: "unknown_room" };
  }

  const occurredAt = effectiveOccurredAt(new Date(event.occurredAt), now);
  const changed = await db.$executeRaw`
    INSERT INTO "locations" ("teacherId", "roomId", "status", "lastEventId", "lastOccurredAt", "updatedAt")
    VALUES (${teacher.id}::uuid, ${receiver?.roomId ?? null}::uuid, ${STATUS[event.status]}::"location_status",
            ${event.eventId}::uuid, ${occurredAt}, ${now})
    ON CONFLICT ("teacherId") DO UPDATE SET
      "roomId" = EXCLUDED."roomId",
      "status" = EXCLUDED."status",
      "lastEventId" = EXCLUDED."lastEventId",
      "lastOccurredAt" = EXCLUDED."lastOccurredAt",
      "updatedAt" = EXCLUDED."updatedAt"
    WHERE "locations"."lastOccurredAt" < EXCLUDED."lastOccurredAt"`;
  if (changed > 0) return { kind: "updated" };

  const current = await db.location.findUnique({
    where: { teacherId: teacher.id },
    select: { lastEventId: true },
  });
  return { kind: whyNotUpdated(current?.lastEventId ?? null, event.eventId) };
}

/** Prisma's "cannot reach the database" errors: the gateway should try again later (503). */
export function isDatabaseUnavailable(error: unknown): boolean {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  return ["P1001", "P1002", "P1008", "P1017", "P2024"].includes(code);
}
