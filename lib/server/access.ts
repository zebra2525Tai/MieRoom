import "server-only";
import {
  clean,
  normalizeReceiverId,
  normalizeTagId,
} from "@/lib/domain/access";
import { MESSAGES } from "@/lib/messages";
import { getDb } from "./db";
import { UUID } from "./reservations";

// S25 タグ・受信機 (F21). The route has checked the site, the sign-in and the 時間割管理者 role.
// The IDs are what the gateway sends (IF01), so a wrong one makes a teacher or a room unreachable:
// they are checked here, and a duplicate is refused by the database itself (ME509).

export type AccessResult =
  | { kind: "done"; notice: "MI501" }
  | { kind: "invalid"; message: string }
  | { kind: "not_found" };

const isDuplicate = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code: unknown }).code === "P2002";

const CODES = {
  ME501: MESSAGES.ME501,
  ME513: MESSAGES.ME513,
  ME514: MESSAGES.ME514,
} as const;

/**
 * タグID of a 講師. An empty text removes the tag. Changing or removing it also removes the
 * teacher's position: it came from the old tag, and must not be shown as the new tag's.
 */
export async function setTagId(
  teacherId: unknown,
  raw: unknown,
): Promise<AccessResult> {
  if (typeof teacherId !== "string" || !UUID.test(teacherId)) {
    return { kind: "not_found" };
  }
  if (raw !== null && typeof raw !== "string") return { kind: "not_found" };
  let tagId: string | null = null;
  if (raw !== null && clean(raw) !== "") {
    const checked = normalizeTagId(raw);
    if (!checked.ok) return { kind: "invalid", message: CODES[checked.code] };
    tagId = checked.value;
  }

  const db = getDb();
  const teacher = await db.teacher.findFirst({
    where: { id: teacherId, active: true },
    select: { tagId: true },
  });
  if (teacher === null) return { kind: "not_found" };
  if (teacher.tagId === tagId) return { kind: "done", notice: "MI501" };
  try {
    await db.$transaction([
      db.teacher.update({ where: { id: teacherId }, data: { tagId } }),
      db.location.deleteMany({ where: { teacherId } }),
    ]);
  } catch (error) {
    if (isDuplicate(error)) return { kind: "invalid", message: MESSAGES.ME509 };
    throw error;
  }
  return { kind: "done", notice: "MI501" };
}

/** 受信機: the ID the gateway sends as roomId, for a room. One room may have several. */
export async function addReceiver(
  roomId: unknown,
  raw: unknown,
): Promise<AccessResult> {
  if (typeof roomId !== "string" || !UUID.test(roomId)) {
    return { kind: "not_found" };
  }
  if (typeof raw !== "string") return { kind: "not_found" };
  const checked = normalizeReceiverId(raw);
  if (!checked.ok) return { kind: "invalid", message: CODES[checked.code] };

  const db = getDb();
  const room = await db.room.findFirst({
    where: { id: roomId, active: true },
    select: { id: true },
  });
  if (room === null) return { kind: "not_found" };
  try {
    await db.receiver.create({
      data: { receiverId: checked.value, roomId },
    });
  } catch (error) {
    if (isDuplicate(error)) return { kind: "invalid", message: MESSAGES.ME509 };
    throw error;
  }
  return { kind: "done", notice: "MI501" };
}

export async function removeReceiver(id: unknown): Promise<AccessResult> {
  if (typeof id !== "string" || !UUID.test(id)) return { kind: "not_found" };
  const removed = await getDb().receiver.deleteMany({ where: { id } });
  return removed.count === 1
    ? { kind: "done", notice: "MI501" }
    : { kind: "not_found" };
}
