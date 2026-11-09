import "server-only";
import { z } from "zod";
import type { PeriodNo, SlotNo } from "@/lib/domain/periods";
import {
  canCancel,
  canReject,
  checkApplication,
  checkApproval,
  checkBlockInput,
  lessonInBlock,
  normalizeInput,
  reservationInBlock,
  reservationInputSchema,
  type BlockRange,
} from "@/lib/domain/reservation-core";
import {
  applicationMessage,
  blockerMessage,
  blockIssueMessage,
} from "@/lib/domain/reservation-text";
import { ALL_FREE } from "@/lib/domain/room-status";
import {
  addDays,
  dateColumnToText,
  isSchoolDate,
  schoolToday,
  textToDateColumn,
} from "@/lib/domain/school-date";
import { MESSAGES } from "@/lib/messages";
import { getDb } from "./db";
import { listSchoolClosures } from "./queries/common";
import { toStored } from "./queries/reservations";
import { loadApprovalFacts } from "./queries/review";
import { FIELD, loadFixedSlots, UUID, type IssueView } from "./reservations";
import type { CurrentUser } from "./session";

// What a 先生 does with reservations and 使用止め (S10〜S13). The routes have checked the site, the
// sign-in and that the user is a 先生. Everything is checked again here, against what is in
// the database now; a change is written only if the row is still in the state that was checked.

export type ReviewResult =
  | { kind: "done"; notice: string }
  | { kind: "confirm"; message: string }
  | { kind: "refused"; message: string }
  | { kind: "not_found" };

const handled = (user: CurrentUser, now: Date) => ({
  handledById: user.id,
  handledByName: user.name.slice(0, 100),
  handledAt: now,
});

async function load(id: unknown) {
  if (typeof id !== "string" || !UUID.test(id)) return null;
  const row = await getDb().reservation.findUnique({
    where: { id },
    select: {
      id: true,
      roomId: true,
      date: true,
      status: true,
      slots: { select: { slot: true } },
    },
  });
  if (row === null) return null;
  return {
    id: row.id,
    roomId: row.roomId,
    stored: toStored(row.status),
    date: dateColumnToText(row.date),
    slots: row.slots.map((s) => s.slot).sort((a, b) => a - b) as SlotNo[],
  };
}

/** S10, S11 「承認」(R4-7). `confirmed` is the answer to MC201. */
export async function approveReservation(
  user: CurrentUser,
  id: unknown,
  confirmed: boolean,
  now: Date,
): Promise<ReviewResult> {
  const reservation = await load(id);
  if (reservation === null) return { kind: "not_found" };
  const facts = (
    await loadApprovalFacts(
      [
        {
          key: "r",
          roomId: reservation.roomId,
          date: reservation.date,
          slots: reservation.slots,
          selfId: reservation.id,
        },
      ],
      now,
    )
  ).get("r")!;
  const check = checkApproval({ ...reservation, now, ...facts });
  if (check.kind === "conflict") {
    return { kind: "refused", message: MESSAGES.ME902 };
  }
  if (check.blockers.length > 0) {
    return {
      kind: "refused",
      message: check.blockers.map(blockerMessage).join(" "),
    };
  }
  if (check.needsConfirmation && !confirmed) {
    return { kind: "confirm", message: MESSAGES.MC201 };
  }
  const changed = await getDb().reservation.updateMany({
    where: { id: reservation.id, status: "PENDING" },
    data: { status: "APPROVED", ...handled(user, now) },
  });
  return changed.count === 1
    ? { kind: "done", notice: "MI201" }
    : { kind: "refused", message: MESSAGES.ME902 };
}

/** S10, S11 「却下」. */
export async function rejectReservation(
  user: CurrentUser,
  id: unknown,
  now: Date,
): Promise<ReviewResult> {
  const reservation = await load(id);
  if (reservation === null) return { kind: "not_found" };
  const check = canReject({ ...reservation, now });
  if (check !== "ok") {
    return {
      kind: "refused",
      message: check === "ME204" ? MESSAGES.ME204 : MESSAGES.ME902,
    };
  }
  const changed = await getDb().reservation.updateMany({
    where: { id: reservation.id, status: "PENDING" },
    data: { status: "REJECTED", ...handled(user, now) },
  });
  return changed.count === 1
    ? { kind: "done", notice: "MI202" }
    : { kind: "refused", message: MESSAGES.ME902 };
}

/** S11 「取消」: an approved one, before its first slot starts (ME205). */
export async function cancelReservation(
  user: CurrentUser,
  id: unknown,
  now: Date,
): Promise<ReviewResult> {
  const reservation = await load(id);
  if (reservation === null) return { kind: "not_found" };
  const check = canCancel({ ...reservation, now });
  if (check !== "ok") {
    return {
      kind: "refused",
      message: check === "ME205" ? MESSAGES.ME205 : MESSAGES.ME902,
    };
  }
  const changed = await getDb().reservation.updateMany({
    where: { id: reservation.id, status: "APPROVED" },
    data: { status: "CANCELLED", ...handled(user, now) },
  });
  return changed.count === 1
    ? { kind: "done", notice: "MI203" }
    : { kind: "refused", message: MESSAGES.ME902 };
}

// ---------------------------------------------------------------- 代理入力 (R4-9)

export type ProxyResult =
  | { kind: "created"; id: string }
  | { kind: "invalid"; issues: IssueView[] }
  | { kind: "confirm"; message: string }
  | { kind: "bad_request" };

/**
 * S12. The same checks as an application (R4-2〜R4-5) and the ones of an approval (R4-7); it is
 * saved as approved, by the 先生 who entered it. The applicant and the one who handled it are
 * the signed-in user, never something sent in the request.
 */
export async function createProxyReservation(
  user: CurrentUser,
  raw: unknown,
  confirmed: boolean,
  now: Date,
): Promise<ProxyResult> {
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
  const today = schoolToday(now);
  const issues: IssueView[] = checkApplication({
    roomActive: room !== null,
    date: input.date,
    slots: input.slots,
    purpose: input.purpose,
    note: input.note,
    slotStatuses: fixed,
    now,
    closures,
  }).map((issue) => ({
    code: issue.code,
    field: FIELD[issue.code],
    message: applicationMessage(issue, { date: input.date, today }),
  }));

  let otherApproved = false;
  if (room !== null && issues.length === 0) {
    const facts = (
      await loadApprovalFacts(
        [
          {
            key: "p",
            roomId: room.id,
            date: input.date,
            slots: input.slots,
          },
        ],
        now,
      )
    ).get("p")!;
    otherApproved = facts.otherApproved;
    if (facts.undecidedClasses.length > 0) {
      issues.push({
        code: "ME201",
        field: "date",
        message: MESSAGES.ME201(facts.undecidedClasses.join("、")),
      });
    }
  }
  if (issues.length > 0 || room === null) return { kind: "invalid", issues };
  if (otherApproved && !confirmed) {
    return { kind: "confirm", message: MESSAGES.MC201 };
  }

  const created = await db.reservation.create({
    data: {
      roomId: room.id,
      date: textToDateColumn(input.date),
      purpose: input.purpose,
      note: input.note,
      status: "APPROVED",
      proxy: true,
      applicantId: user.id,
      applicantName: user.name.slice(0, 100),
      ...handled(user, now),
      slots: { create: input.slots.map((slot) => ({ slot })) },
    },
    select: { id: true },
  });
  return { kind: "created", id: created.id };
}

// ---------------------------------------------------------------- 使用止め (R4-10)

const MAX_BLOCK_DAYS = 400;

const blockInputSchema = z.object({
  roomId: z.string().max(64),
  startDate: z.string().refine(isSchoolDate),
  startPeriod: z.coerce.number().int().min(1).max(4),
  endDate: z.string().refine(isSchoolDate),
  endPeriod: z.coerce.number().int().min(1).max(4),
});

export type BlockResult =
  | {
      kind: "created";
      /** MW301, MW302: what the block touches. It is saved all the same. */
      reservations: number;
      lessons: number;
    }
  | { kind: "invalid"; message: string }
  | { kind: "bad_request" };

/** How many approved reservations and lessons a block touches (MW301, MW302, S13). */
export async function countBlockOverlaps(
  roomId: string,
  block: BlockRange,
): Promise<{ reservations: number; lessons: number }> {
  const db = getDb();
  const range = {
    gte: textToDateColumn(block.startDate),
    lte: textToDateColumn(block.endDate),
  };
  const [reservations, lessons] = await Promise.all([
    db.reservation.findMany({
      where: { roomId, status: "APPROVED", date: range },
      select: { date: true, slots: { select: { slot: true } } },
    }),
    db.lesson.findMany({
      where: { roomId, cancelled: false, date: range },
      select: { date: true, startMinutes: true, endMinutes: true },
    }),
  ]);
  return {
    reservations: reservations.filter((r) =>
      reservationInBlock(block, {
        date: dateColumnToText(r.date),
        slots: r.slots.map((s) => s.slot) as SlotNo[],
      }),
    ).length,
    lessons: lessons.filter((l) =>
      lessonInBlock(block, {
        date: dateColumnToText(l.date),
        startMinutes: l.startMinutes,
        endMinutes: l.endMinutes,
        cancelled: false,
      }),
    ).length,
  };
}

/** S13 「設定する」: any 先生. A block does not cancel anything by itself (R4-10). */
export async function createBlock(
  user: CurrentUser,
  raw: unknown,
  now: Date,
): Promise<BlockResult> {
  const parsed = blockInputSchema.safeParse(raw);
  if (!parsed.success) return { kind: "bad_request" };
  const input = parsed.data;
  const block: BlockRange = {
    startDate: input.startDate,
    startPeriod: input.startPeriod as PeriodNo,
    endDate: input.endDate,
    endPeriod: input.endPeriod as PeriodNo,
  };
  if (input.endDate > addDays(input.startDate, MAX_BLOCK_DAYS)) {
    return { kind: "bad_request" };
  }

  const issues = checkBlockInput({ ...block, now });
  if (issues.length > 0) {
    return {
      kind: "invalid",
      message: issues.map(blockIssueMessage).join(" "),
    };
  }
  const db = getDb();
  const room = UUID.test(input.roomId)
    ? await db.room.findFirst({
        where: { id: input.roomId, active: true },
        select: { id: true },
      })
    : null;
  if (room === null) return { kind: "invalid", message: MESSAGES.ME109 };

  await db.roomBlock.create({
    data: {
      roomId: room.id,
      startDate: textToDateColumn(block.startDate),
      startPeriod: block.startPeriod,
      endDate: textToDateColumn(block.endDate),
      endPeriod: block.endPeriod,
      setById: user.id,
      setByName: user.name.slice(0, 100),
    },
  });
  return { kind: "created", ...(await countBlockOverlaps(room.id, block)) };
}

/** S13 「解除」: any 先生. */
export async function releaseBlock(
  id: unknown,
): Promise<"released" | "not_found"> {
  if (typeof id !== "string" || !UUID.test(id)) return "not_found";
  const removed = await getDb().roomBlock.deleteMany({ where: { id } });
  return removed.count === 1 ? "released" : "not_found";
}
