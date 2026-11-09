import "server-only";
import {
  checkApplication,
  canWithdraw,
  normalizeInput,
  reservationInputSchema,
  slotStatuses,
  type ApplicationIssue,
} from "@/lib/domain/reservation-core";
import type { SlotNo } from "@/lib/domain/periods";
import { applicationMessage } from "@/lib/domain/reservation-text";
import { ALL_FREE } from "@/lib/domain/room-status";
import {
  addDays,
  dateColumnToText,
  schoolToday,
  textToDateColumn,
} from "@/lib/domain/school-date";
import { lessonSlotsByRoom } from "@/lib/domain/timetable-read";
import { MESSAGES } from "@/lib/messages";
import { getDb } from "./db";
import { listSchoolClosures } from "./queries/common";
import { loadDayOverlays, toStored } from "./queries/reservations";
import type { CurrentUser } from "./session";

// Writing 予約 (S06, S07). The routes have already checked the site, the sign-in and the role;
// the rules (R4-2〜R4-5) are checked again here, on the server, for every request.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type IssueView = {
  code: string;
  field: "room" | "date" | "slots" | "purpose" | "note";
  message: string;
};

const FIELD: Record<ApplicationIssue["code"], IssueView["field"]> = {
  ME101: "date",
  ME102: "date",
  ME103: "date",
  ME104: "slots",
  ME105: "slots",
  ME106: "slots",
  ME107: "purpose",
  ME108: "note",
  ME109: "room",
};

export type ApplyResult =
  | { kind: "created"; id: string }
  | { kind: "invalid"; issues: IssueView[] }
  | { kind: "bad_request" };

/**
 * The state of the room's slots that are fixed (授業 and 使用止め), for the checks. Reservations
 * are left out: other requests and approved reservations on the same slots are only warnings.
 */
async function loadFixedSlots(roomId: string, date: string, now: Date) {
  const db = getDb();
  const [lessons, overlays] = await Promise.all([
    db.lesson.findMany({
      where: { roomId, date: textToDateColumn(date) },
      select: {
        roomId: true,
        startMinutes: true,
        endMinutes: true,
        cancelled: true,
        class: { select: { name: true } },
      },
    }),
    loadDayOverlays(date, roomId),
  ]);
  const byRoom = lessonSlotsByRoom(
    lessons.map(({ class: owner, ...lesson }) => ({
      ...lesson,
      className: owner.name,
    })),
  );
  return slotStatuses({
    lessonSlots: byRoom.get(roomId) ?? ALL_FREE,
    blockedPeriods: overlays.blockedPeriods.get(roomId),
    now,
  });
}

/** S06: an application by the signed-in user. `raw` is whatever the client sent. */
export async function createReservation(
  user: CurrentUser,
  raw: unknown,
  now: Date,
): Promise<ApplyResult> {
  const parsed = reservationInputSchema.safeParse(raw);
  if (!parsed.success) return { kind: "bad_request" };
  const input = normalizeInput(parsed.data);

  const db = getDb();
  const room = UUID.test(input.roomId)
    ? await db.room.findFirst({
        where: { id: input.roomId, active: true },
        select: { id: true },
      })
    : null;

  const [fixed, closures] = await Promise.all([
    room ? loadFixedSlots(room.id, input.date, now) : Promise.resolve(ALL_FREE),
    listSchoolClosures(addDays(input.date, -60), input.date),
  ]);
  const issues = checkApplication({
    roomActive: room !== null,
    date: input.date,
    slots: input.slots,
    purpose: input.purpose,
    note: input.note,
    slotStatuses: fixed,
    now,
    closures,
  });
  if (issues.length > 0 || room === null) {
    const today = schoolToday(now);
    return {
      kind: "invalid",
      issues: issues.map((issue) => ({
        code: issue.code,
        field: FIELD[issue.code],
        message: applicationMessage(issue, { date: input.date, today }),
      })),
    };
  }

  const created = await db.reservation.create({
    data: {
      roomId: room.id,
      date: textToDateColumn(input.date),
      purpose: input.purpose,
      note: input.note,
      status: "PENDING",
      proxy: false,
      applicantId: user.id,
      applicantName: user.name.slice(0, 100),
      slots: { create: input.slots.map((slot) => ({ slot })) },
    },
    select: { id: true },
  });
  return { kind: "created", id: created.id };
}

export type WithdrawResult =
  | { kind: "withdrawn" }
  | { kind: "refused"; message: string }
  | { kind: "not_found" };

/** S07 「取り下げ」: only the applicant, only while waiting and before the first slot starts. */
export async function withdrawReservation(
  user: CurrentUser,
  id: unknown,
  now: Date,
): Promise<WithdrawResult> {
  if (typeof id !== "string" || !UUID.test(id)) return { kind: "not_found" };
  const db = getDb();
  const reservation = await db.reservation.findFirst({
    where: { id, applicantId: user.id },
    select: { date: true, status: true, slots: { select: { slot: true } } },
  });
  if (reservation === null) return { kind: "not_found" };

  const check = canWithdraw({
    stored: toStored(reservation.status),
    date: dateColumnToText(reservation.date),
    slots: reservation.slots.map((row) => row.slot) as SlotNo[],
    now,
  });
  if (check !== "ok") return { kind: "refused", message: MESSAGES.ME110 };

  // Only while it is still waiting: if a teacher answered in the meantime, nothing changes.
  const changed = await db.reservation.updateMany({
    where: { id, applicantId: user.id, status: "PENDING" },
    data: { status: "WITHDRAWN" },
  });
  return changed.count === 1
    ? { kind: "withdrawn" }
    : { kind: "refused", message: MESSAGES.ME110 };
}
