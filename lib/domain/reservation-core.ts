import { TZDate } from "@date-fns/tz";
import { z } from "zod";
import { SCHOOL_TIME_ZONE } from "./fiscal-year";
import {
  PERIODS,
  SLOTS,
  toMinutes,
  type PeriodNo,
  type SlotNo,
} from "./periods";
import { checkApplicationDate, type SchoolClosure } from "./reservation-rules";
import { ALL_FREE, type SlotStatus } from "./room-status";
import { isSchoolDate } from "./school-date";

// 予約と使用止めの規則 (外部設計書 R4-1〜R4-10). No I/O here: the screens and the server
// functions give it facts (what is in the database) and get back what the rules say.

// ---------------------------------------------------------------- time

/** A moment in Japan: date "2026-11-20" and time "13:30". Plain Date, not a TZDate. */
export function schoolInstant(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const minutes = toMinutes(time);
  return new Date(
    new TZDate(
      year,
      month - 1,
      day,
      Math.floor(minutes / 60),
      minutes % 60,
      0,
      SCHOOL_TIME_ZONE,
    ).getTime(),
  );
}

export function periodStartAt(date: string, periodNo: PeriodNo): Date {
  return schoolInstant(date, PERIODS[periodNo - 1].start);
}

export function periodEndAt(date: string, periodNo: PeriodNo): Date {
  return schoolInstant(date, PERIODS[periodNo - 1].end);
}

const sortedSlots = (slots: readonly SlotNo[]) =>
  [...slots].sort((a, b) => a - b);

/** When the first slot starts. Approving, rejecting, cancelling and withdrawing end here (R4-6). */
export function reservationStartAt(
  date: string,
  slots: readonly SlotNo[],
): Date {
  return schoolInstant(date, SLOTS[sortedSlots(slots)[0] - 1].start);
}

export function reservationEndAt(date: string, slots: readonly SlotNo[]): Date {
  return schoolInstant(date, SLOTS[sortedSlots(slots).at(-1)! - 1].end);
}

/** 3限前半〜4限後半(13:30-16:45) (6-1) */
export function slotRangeText(slots: readonly SlotNo[]): string {
  const ordered = sortedSlots(slots);
  const first = SLOTS[ordered[0] - 1];
  const last = SLOTS[ordered.at(-1)! - 1];
  const label =
    first.no === last.no ? first.label : `${first.label}〜${last.label}`;
  return `${label}(${first.start}-${last.end})`;
}

// ---------------------------------------------------------------- status

export type StoredReservationStatus =
  "pending" | "approved" | "rejected" | "cancelled" | "withdrawn";
export type ReservationStatus = StoredReservationStatus | "expired";

/**
 * 期限切れ is never stored (R4-6): a request still waiting when its first slot starts.
 * Everything else is what was stored.
 */
export function effectiveStatus(
  stored: StoredReservationStatus,
  date: string,
  slots: readonly SlotNo[],
  now: Date,
): ReservationStatus {
  if (stored === "pending" && now >= reservationStartAt(date, slots)) {
    return "expired";
  }
  return stored;
}

// ---------------------------------------------------------------- input

export const PURPOSES = ["自習", "就活", "その他"] as const;
export const NOTE_MAX_LENGTH = 100;

/**
 * The shape of an application, from a form. Whether the values are acceptable is for
 * checkApplication (it answers with ME codes); this only makes sure they have the right types.
 */
export const reservationInputSchema = z.object({
  roomId: z.string().max(64),
  date: z.string().refine(isSchoolDate),
  slots: z.array(z.coerce.number().int().min(1).max(8)).max(8),
  purpose: z.string().max(20),
  note: z.string().max(2000),
});

export type ReservationInput = {
  roomId: string;
  date: string;
  slots: SlotNo[];
  purpose: string;
  note: string;
};

/** Trim, and put the slots in order without repeats. */
export function normalizeInput(
  input: z.infer<typeof reservationInputSchema>,
): ReservationInput {
  return {
    roomId: input.roomId,
    date: input.date,
    slots: [...new Set(input.slots)].sort((a, b) => a - b) as SlotNo[],
    purpose: input.purpose.trim(),
    note: input.note.trim(),
  };
}

/** Full-width and half-width characters count the same (6-3); a character is a code point. */
export const characterCount = (text: string) => [...text].length;

/** R4-4: one or more slots, next to each other (1限前半, 1限後半, 2限前半 ...). */
export function isContinuous(slots: readonly number[]): boolean {
  if (slots.length === 0) return false;
  const ordered = [...slots].sort((a, b) => a - b);
  if (ordered.some((slot, i) => i > 0 && slot !== ordered[i - 1] + 1)) {
    return false;
  }
  return ordered[0] >= 1 && ordered.at(-1)! <= 8;
}

// ---------------------------------------------------------------- slot states (R4-1)

export type SlotReservation = {
  status: StoredReservationStatus;
  slots: readonly SlotNo[];
  date: string;
};

/**
 * 枠の状態 of one room on one day. In order: 使用止め, 授業, 予約済み, 仮予約あり, 空き.
 * `lessonSlots` already leaves out 休講 and lessons without a room (lessonSlotsByRoom).
 * A request that has expired is not a 仮予約.
 */
export function slotStatuses(input: {
  lessonSlots?: Record<SlotNo, SlotStatus>;
  blockedPeriods?: ReadonlySet<PeriodNo>;
  reservations?: readonly SlotReservation[];
  now: Date;
}): Record<SlotNo, SlotStatus> {
  const lessonSlots = input.lessonSlots ?? ALL_FREE;
  const approved = new Set<number>();
  const pending = new Set<number>();
  for (const reservation of input.reservations ?? []) {
    const status = effectiveStatus(
      reservation.status,
      reservation.date,
      reservation.slots,
      input.now,
    );
    if (status === "approved")
      reservation.slots.forEach((n) => approved.add(n));
    if (status === "pending") reservation.slots.forEach((n) => pending.add(n));
  }
  const result = { ...ALL_FREE };
  for (const slot of SLOTS) {
    const lesson = lessonSlots[slot.no];
    if (input.blockedPeriods?.has(slot.periodNo)) {
      result[slot.no] = { kind: "blocked" };
    } else if (lesson.kind === "lesson") {
      result[slot.no] = lesson;
    } else if (approved.has(slot.no)) {
      result[slot.no] = { kind: "reserved" };
    } else if (pending.has(slot.no)) {
      result[slot.no] = { kind: "pending" };
    }
  }
  return result;
}

// ---------------------------------------------------------------- applying (R4-2〜R4-5)

export type ApplicationIssue =
  | { code: "ME101"; deadlineDate: string }
  | { code: "ME102" }
  | { code: "ME103" }
  | { code: "ME104" }
  | { code: "ME105"; slots: SlotNo[] }
  | { code: "ME106"; periods: PeriodNo[] }
  | { code: "ME107" }
  | { code: "ME108" }
  | { code: "ME109" };

/**
 * R4-5. All the errors that apply, in the order of the table. `slotStatuses` must show only
 * what is fixed (授業 and 使用止め), which is what slotStatuses() gives with no reservations,
 * or with them: only the kinds "lesson" and "blocked" matter here.
 * Other requests and approved reservations on the same slots are not errors (MW101, MW102).
 */
export function checkApplication(input: {
  roomActive: boolean;
  date: string;
  slots: readonly SlotNo[];
  purpose: string;
  note: string;
  slotStatuses: Record<SlotNo, SlotStatus>;
  now: Date;
  closures: readonly SchoolClosure[];
}): ApplicationIssue[] {
  const issues: ApplicationIssue[] = [];
  if (!input.roomActive) issues.push({ code: "ME109" });

  const range = checkApplicationDate(input.date, input.now, input.closures);
  if (!range.ok) {
    issues.push(
      range.code === "ME101"
        ? { code: "ME101", deadlineDate: range.deadlineDate }
        : { code: range.code },
    );
  }

  if (!isContinuous(input.slots)) issues.push({ code: "ME104" });

  const ordered = sortedSlots(input.slots).filter((n) => n >= 1 && n <= 8);
  const withLesson = ordered.filter(
    (n) => input.slotStatuses[n]?.kind === "lesson",
  );
  if (withLesson.length > 0) issues.push({ code: "ME105", slots: withLesson });

  // 使用止め covers a whole period, so a single blocked slot refuses the whole request.
  const blockedPeriods = [
    ...new Set(
      ordered
        .filter((n) => input.slotStatuses[n]?.kind === "blocked")
        .map((n) => SLOTS[n - 1].periodNo),
    ),
  ];
  if (blockedPeriods.length > 0) {
    issues.push({ code: "ME106", periods: blockedPeriods });
  }

  if (!(PURPOSES as readonly string[]).includes(input.purpose)) {
    issues.push({ code: "ME107" });
  }
  if (characterCount(input.note) > NOTE_MAX_LENGTH) {
    issues.push({ code: "ME108" });
  }
  return issues;
}

// ---------------------------------------------------------------- approving (R4-7, R4-8)

export type ApprovalBlocker =
  | { code: "ME201"; classes: string[] }
  | { code: "ME202" }
  | { code: "ME203" }
  | { code: "ME204" };

export type ApprovalWarning =
  | { code: "MW201"; count: number }
  | { code: "MW202" }
  | { code: "MW203"; classes: string[] };

/** MW201〜MW203 (R4-8). Shown for requests waiting, and on the proxy form (MW202, MW203). */
export function approvalWarnings(input: {
  otherPending: number;
  otherApproved: boolean;
  homeroomClassesWithUndecidedLesson: string[];
}): ApprovalWarning[] {
  const warnings: ApprovalWarning[] = [];
  if (input.otherPending > 0) {
    warnings.push({ code: "MW201", count: input.otherPending });
  }
  if (input.otherApproved) warnings.push({ code: "MW202" });
  if (input.homeroomClassesWithUndecidedLesson.length > 0) {
    warnings.push({
      code: "MW203",
      classes: input.homeroomClassesWithUndecidedLesson,
    });
  }
  return warnings;
}

export type ApprovalCheck =
  | {
      /** Somebody else handled it first: ME902, and the screen reads again. */
      kind: "conflict";
    }
  | {
      kind: "checked";
      blockers: ApprovalBlocker[];
      warnings: ApprovalWarning[];
      /** MC201: an approved reservation is on the same slots. Asked, then it may go on. */
      needsConfirmation: boolean;
    };

/**
 * Approving or rejecting a request (R4-7). Both need: still waiting, and the first slot has not
 * started (ME204). Only approving also needs the other conditions; `blockers` lists them all,
 * and a request with any blocker cannot be approved (it can still be rejected).
 * `fixedSlotStatuses` is 授業 and 使用止め as they are now (not the reservations).
 */
export function checkApproval(input: {
  stored: StoredReservationStatus;
  date: string;
  slots: readonly SlotNo[];
  now: Date;
  fixedSlotStatuses: Record<SlotNo, SlotStatus>;
  undecidedClasses: string[];
  otherPending: number;
  otherApproved: boolean;
  homeroomClassesWithUndecidedLesson: string[];
}): ApprovalCheck {
  if (input.stored !== "pending") return { kind: "conflict" };

  const warnings = approvalWarnings(input);
  const needsConfirmation = input.otherApproved;
  if (input.now >= reservationStartAt(input.date, input.slots)) {
    return {
      kind: "checked",
      blockers: [{ code: "ME204" }],
      warnings,
      needsConfirmation,
    };
  }

  const blockers: ApprovalBlocker[] = [];
  if (input.undecidedClasses.length > 0) {
    blockers.push({ code: "ME201", classes: input.undecidedClasses });
  }
  const kinds = input.slots.map((n) => input.fixedSlotStatuses[n]?.kind);
  if (kinds.includes("lesson")) blockers.push({ code: "ME202" });
  if (kinds.includes("blocked")) blockers.push({ code: "ME203" });
  return { kind: "checked", blockers, warnings, needsConfirmation };
}

/** The same date, but only the states that stop a rejection: it is possible until it starts. */
export function canReject(input: {
  stored: StoredReservationStatus;
  date: string;
  slots: readonly SlotNo[];
  now: Date;
}): "ok" | "conflict" | "ME204" {
  if (input.stored !== "pending") return "conflict";
  return input.now >= reservationStartAt(input.date, input.slots)
    ? "ME204"
    : "ok";
}

/** 取消 (R4-6): only an approved one, and only before its first slot starts (ME205). */
export function canCancel(input: {
  stored: StoredReservationStatus;
  date: string;
  slots: readonly SlotNo[];
  now: Date;
}): "ok" | "conflict" | "ME205" {
  if (input.stored !== "approved") return "conflict";
  return input.now >= reservationStartAt(input.date, input.slots)
    ? "ME205"
    : "ok";
}

/** 取り下げ (R4-6): the applicant, while it waits and before its first slot starts (ME110). */
export function canWithdraw(input: {
  stored: StoredReservationStatus;
  date: string;
  slots: readonly SlotNo[];
  now: Date;
}): "ok" | "ME110" {
  return input.stored === "pending" &&
    input.now < reservationStartAt(input.date, input.slots)
    ? "ok"
    : "ME110";
}

// ---------------------------------------------------------------- 使用止め (R4-10)

export type BlockRange = {
  startDate: string;
  startPeriod: PeriodNo;
  endDate: string;
  endPeriod: PeriodNo;
};

/** Is this period of this day inside the range? Both ends are included. */
export function blockCovers(
  block: BlockRange,
  date: string,
  periodNo: PeriodNo,
): boolean {
  const after =
    date > block.startDate ||
    (date === block.startDate && periodNo >= block.startPeriod);
  const before =
    date < block.endDate ||
    (date === block.endDate && periodNo <= block.endPeriod);
  return after && before;
}

export function blockedPeriodsOn(
  blocks: readonly BlockRange[],
  date: string,
): Set<PeriodNo> {
  const periods = new Set<PeriodNo>();
  for (const block of blocks) {
    for (const period of PERIODS) {
      if (blockCovers(block, date, period.no)) periods.add(period.no);
    }
  }
  return periods;
}

/** A block is listed until its last period is over (S13). */
export function blockEndAt(block: BlockRange): Date {
  return periodEndAt(block.endDate, block.endPeriod);
}

export type BlockIssue = { code: "ME301" } | { code: "ME302" };

/** ME301: the end is before the start. ME302: the first period has already started. */
export function checkBlockInput(
  input: BlockRange & { now: Date },
): BlockIssue[] {
  const issues: BlockIssue[] = [];
  const endsBefore =
    input.endDate < input.startDate ||
    (input.endDate === input.startDate && input.endPeriod < input.startPeriod);
  if (endsBefore) issues.push({ code: "ME301" });
  if (periodStartAt(input.startDate, input.startPeriod) <= input.now) {
    issues.push({ code: "ME302" });
  }
  return issues;
}

/** Does an approved reservation touch the block (MW301, the count in S13)? */
export function reservationInBlock(
  block: BlockRange,
  reservation: { date: string; slots: readonly SlotNo[] },
): boolean {
  return reservation.slots.some((n) =>
    blockCovers(block, reservation.date, SLOTS[n - 1].periodNo),
  );
}

/** Does a lesson touch the block (MW302)? By time, like the 枠 (R3-1). */
export function lessonInBlock(
  block: BlockRange,
  lesson: {
    date: string;
    startMinutes: number;
    endMinutes: number;
    cancelled: boolean;
  },
): boolean {
  if (lesson.cancelled) return false;
  return PERIODS.some(
    (period) =>
      blockCovers(block, lesson.date, period.no) &&
      lesson.startMinutes < toMinutes(period.end) &&
      lesson.endMinutes > toMinutes(period.start),
  );
}

// ---------------------------------------------------------------- order of lists

/** S10, S11: earliest date, then earliest first slot. */
export function compareByStart(
  a: { date: string; slots: readonly SlotNo[] },
  b: { date: string; slots: readonly SlotNo[] },
): number {
  return (
    a.date.localeCompare(b.date) ||
    sortedSlots(a.slots)[0] - sortedSlots(b.slots)[0]
  );
}

/**
 * S07: the ones not over yet, nearest first; below them the ones that are over, newest first.
 * "Over" is when the last slot has ended.
 */
export function orderMine<T extends { date: string; slots: readonly SlotNo[] }>(
  rows: readonly T[],
  now: Date,
): T[] {
  const upcoming = rows
    .filter((row) => reservationEndAt(row.date, row.slots) > now)
    .sort(compareByStart);
  const over = rows
    .filter((row) => reservationEndAt(row.date, row.slots) <= now)
    .sort((a, b) => compareByStart(b, a));
  return [...upcoming, ...over];
}

// ---------------------------------------------------------------- the timetable and 予約 (R4-12)

export type NewLesson = {
  date: string;
  startMinutes: number;
  endMinutes: number;
  /** The room's name; null: 教室未定 (it takes no room) */
  room: string | null;
};

/**
 * MW402: how many approved reservations a new timetable's lessons overlap. By time, in the same
 * room on the same day; a lesson ending when a slot starts does not overlap it (R3-1).
 */
export function reservationsTouchedByLessons(
  lessons: readonly NewLesson[],
  reservations: readonly {
    id: string;
    room: string;
    date: string;
    slots: readonly SlotNo[];
  }[],
): number {
  return reservations.filter((reservation) =>
    lessons.some(
      (lesson) =>
        lesson.room === reservation.room &&
        lesson.date === reservation.date &&
        reservation.slots.some(
          (n) =>
            lesson.startMinutes < toMinutes(SLOTS[n - 1].end) &&
            lesson.endMinutes > toMinutes(SLOTS[n - 1].start),
        ),
    ),
  ).length;
}

/** MW403: how many of the new lessons fall in a 使用止め of their room. */
export function lessonsInBlocks(
  lessons: readonly NewLesson[],
  blocks: readonly (BlockRange & { room: string })[],
): number {
  return lessons.filter(
    (lesson) =>
      lesson.room !== null &&
      blocks.some(
        (block) =>
          block.room === lesson.room &&
          lessonInBlock(block, { ...lesson, cancelled: false }),
      ),
  ).length;
}
