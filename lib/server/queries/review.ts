import "server-only";
import type { ReservationRow } from "@/components/screens/reservation-lists";
import { SLOTS, toMinutes, type SlotNo } from "@/lib/domain/periods";
import {
  blockedPeriodsOn,
  checkApproval,
  compareByStart,
  effectiveStatus,
  reservationInBlock,
  slotRangeText,
  slotStatuses,
  type BlockRange,
  type ReservationStatus,
  type SlotReservation,
} from "@/lib/domain/reservation-core";
import { blockerMessage, warningMessage } from "@/lib/domain/reservation-text";
import { ALL_FREE, type SlotStatus } from "@/lib/domain/room-status";
import {
  dateColumnToText,
  fiscalYearOfDate,
  formatDate,
  schoolDateTimeText,
  textToDateColumn,
} from "@/lib/domain/school-date";
import { isEntered, lessonSlotsByRoom } from "@/lib/domain/timetable-read";
import { getDb } from "../db";
import { inYear } from "./common";
import { loadMonthStates, monthsAround, NO_STATES } from "./lessons";
import { PAGE_SIZE, toStored } from "./reservations";

// What 先生's screens (S10, S11, S13) and the approval itself need to know about a reservation:
// the facts around it, and the words for them. Callers have checked that the user is a 先生.

export type ApprovalEntry = {
  key: string;
  roomId: string;
  date: string;
  slots: readonly SlotNo[];
  /** The reservation itself, so that it does not count as "another" one. */
  selfId?: string;
};

export type ApprovalFacts = {
  fixedSlotStatuses: Record<SlotNo, SlotStatus>;
  undecidedClasses: string[];
  otherPending: number;
  otherApproved: boolean;
  homeroomClassesWithUndecidedLesson: string[];
};

const timeRange = (slots: readonly SlotNo[]) => ({
  start: toMinutes(SLOTS[Math.min(...slots) - 1].start),
  end: toMinutes(SLOTS[Math.max(...slots) - 1].end),
});

/**
 * For each entry: 授業 and 使用止め as they are now, the classes whose timetable of the day is
 * 未定, the other waiting requests and approved reservations on the same slots (R4-7, R4-8), and
 * the homeroom classes with a lesson without a room at that time (MW203). A few queries for all
 * entries together.
 */
export async function loadApprovalFacts(
  entries: ApprovalEntry[],
  now: Date,
): Promise<Map<string, ApprovalFacts>> {
  const result = new Map<string, ApprovalFacts>();
  if (entries.length === 0) return result;
  const db = getDb();
  const dates = [...new Set(entries.map((e) => e.date))].sort();
  const roomIds = [...new Set(entries.map((e) => e.roomId))];
  const years = [...new Set(dates.map(fiscalYearOfDate))];

  const [lessons, reservations, blocks, classLists] = await Promise.all([
    db.lesson.findMany({
      where: { date: { in: dates.map(textToDateColumn) } },
      select: {
        date: true,
        classId: true,
        roomId: true,
        kind: true,
        startMinutes: true,
        endMinutes: true,
        cancelled: true,
        class: { select: { name: true } },
      },
    }),
    db.reservation.findMany({
      where: {
        date: { in: dates.map(textToDateColumn) },
        roomId: { in: roomIds },
        status: { in: ["PENDING", "APPROVED"] },
      },
      select: {
        id: true,
        roomId: true,
        date: true,
        status: true,
        slots: { select: { slot: true } },
      },
    }),
    db.roomBlock.findMany({
      where: {
        roomId: { in: roomIds },
        startDate: { lte: textToDateColumn(dates.at(-1)!) },
        endDate: { gte: textToDateColumn(dates[0]) },
      },
      select: {
        roomId: true,
        startDate: true,
        startPeriod: true,
        endDate: true,
        endPeriod: true,
      },
    }),
    Promise.all(
      years.map(async (year) => ({
        year,
        classes: await db.schoolClass.findMany({
          where: inYear(year),
          select: { id: true, name: true, homeRoomId: true },
          orderBy: { name: "asc" },
        }),
      })),
    ),
  ]);
  const classesOf = new Map(classLists.map((l) => [l.year, l.classes]));
  const states = await loadMonthStates(
    [...new Set(classLists.flatMap((l) => l.classes.map((c) => c.id)))],
    monthsAround(dates),
  );

  for (const entry of entries) {
    const classes = classesOf.get(fiscalYearOfDate(entry.date)) ?? [];
    const lessonsOfDay = lessons.filter(
      (l) => dateColumnToText(l.date) === entry.date && !l.cancelled,
    );

    const fixedLessons = lessonsOfDay.filter((l) => l.roomId === entry.roomId);
    const byRoom = lessonSlotsByRoom(
      fixedLessons.map((l) => ({
        roomId: l.roomId,
        className: l.class.name,
        startMinutes: l.startMinutes,
        endMinutes: l.endMinutes,
        cancelled: false,
      })),
    );
    const ranges: BlockRange[] = blocks
      .filter((b) => b.roomId === entry.roomId)
      .map((b) => ({
        startDate: dateColumnToText(b.startDate),
        startPeriod: b.startPeriod as BlockRange["startPeriod"],
        endDate: dateColumnToText(b.endDate),
        endPeriod: b.endPeriod as BlockRange["endPeriod"],
      }));
    const fixedSlotStatuses = slotStatuses({
      lessonSlots: byRoom.get(entry.roomId) ?? ALL_FREE,
      blockedPeriods: blockedPeriodsOn(ranges, entry.date),
      now,
    });

    const touching = reservations.filter(
      (r) =>
        r.roomId === entry.roomId &&
        dateColumnToText(r.date) === entry.date &&
        r.id !== entry.selfId &&
        r.slots.some((s) => entry.slots.includes(s.slot as SlotNo)),
    );
    const others: SlotReservation[] = touching.map((r) => ({
      status: toStored(r.status),
      date: entry.date,
      slots: r.slots.map((s) => s.slot as SlotNo),
    }));
    const live = (r: SlotReservation) =>
      effectiveStatus(r.status, r.date, r.slots, now);

    const { start, end } = timeRange(entry.slots);
    const homeroomClasses = classes
      .filter((c) => c.homeRoomId === entry.roomId)
      .filter((c) =>
        lessonsOfDay.some(
          (l) =>
            l.classId === c.id &&
            l.roomId === null &&
            l.startMinutes < end &&
            l.endMinutes > start,
        ),
      )
      .map((c) => c.name);

    result.set(entry.key, {
      fixedSlotStatuses,
      undecidedClasses: classes
        .filter((c) => !isEntered(entry.date, states.get(c.id) ?? NO_STATES))
        .map((c) => c.name),
      otherPending: others.filter((r) => live(r) === "pending").length,
      otherApproved: others.some((r) => live(r) === "approved"),
      homeroomClassesWithUndecidedLesson: homeroomClasses,
    });
  }
  return result;
}

// ---------------------------------------------------------------- rows

const SELECT = {
  id: true,
  roomId: true,
  date: true,
  purpose: true,
  note: true,
  status: true,
  proxy: true,
  applicantName: true,
  handledByName: true,
  handledAt: true,
  createdAt: true,
  room: { select: { name: true } },
  slots: { select: { slot: true } },
} as const;

type Item = {
  id: string;
  roomId: string;
  date: Date;
  purpose: string;
  note: string;
  status: string;
  proxy: boolean;
  applicantName: string;
  handledByName: string | null;
  handledAt: Date | null;
  createdAt: Date;
  room: { name: string };
  slots: { slot: number }[];
};

/** The rows of S10, S11: with the warnings and the reasons an approval is refused (R4-7, R4-8). */
async function toRows(
  items: Item[],
  today: string,
  now: Date,
): Promise<ReservationRow[]> {
  const prepared = items.map((item) => {
    const date = dateColumnToText(item.date);
    const slots = item.slots
      .map((s) => s.slot)
      .sort((a, b) => a - b) as SlotNo[];
    return {
      item,
      date,
      slots,
      status: effectiveStatus(toStored(item.status), date, slots, now),
    };
  });
  const facts = await loadApprovalFacts(
    prepared
      .filter((p) => p.status === "pending")
      .map((p) => ({
        key: p.item.id,
        roomId: p.item.roomId,
        date: p.date,
        slots: p.slots,
        selfId: p.item.id,
      })),
    now,
  );
  return prepared.map(({ item, date, slots, status }) => {
    const fact = facts.get(item.id);
    const check = fact
      ? checkApproval({
          stored: "pending",
          date,
          slots,
          now,
          ...fact,
        })
      : null;
    return {
      id: item.id,
      dateText: formatDate(date, today),
      slotText: slotRangeText(slots),
      room: item.room.name,
      purpose: item.purpose,
      note: item.note,
      applicant: item.applicantName,
      createdText: schoolDateTimeText(item.createdAt),
      status: status as ReservationStatus,
      handledBy: item.handledByName,
      handledText: item.handledAt ? schoolDateTimeText(item.handledAt) : null,
      proxy: item.proxy,
      warnings:
        check?.kind === "checked" ? check.warnings.map(warningMessage) : [],
      blockedReasons:
        check?.kind === "checked" ? check.blockers.map(blockerMessage) : [],
      needsConfirm: check?.kind === "checked" && check.needsConfirmation,
    };
  });
}

/** S10: the requests still waiting (expired ones left out), earliest first. */
export async function listPendingRows(
  today: string,
  now: Date,
  page: number,
): Promise<{ rows: ReservationRow[]; total: number; hasNext: boolean }> {
  const items = await getDb().reservation.findMany({
    where: { status: "PENDING", date: { gte: textToDateColumn(today) } },
    select: SELECT,
  });
  const live = items
    .map((item) => ({
      item,
      date: dateColumnToText(item.date),
      slots: item.slots.map((s) => s.slot).sort((a, b) => a - b) as SlotNo[],
    }))
    .filter(
      (p) => effectiveStatus("pending", p.date, p.slots, now) === "pending",
    )
    .sort(compareByStart);
  const start = (page - 1) * PAGE_SIZE;
  return {
    rows: await toRows(
      live.slice(start, start + PAGE_SIZE).map((p) => p.item),
      today,
      now,
    ),
    total: live.length,
    hasNext: live.length > start + PAGE_SIZE,
  };
}

/** How many requests wait (the number on the menu). */
export async function countPending(today: string, now: Date): Promise<number> {
  const items = await getDb().reservation.findMany({
    where: { status: "PENDING", date: { gte: textToDateColumn(today) } },
    select: { date: true, slots: { select: { slot: true } } },
  });
  return items.filter(
    (item) =>
      effectiveStatus(
        "pending",
        dateColumnToText(item.date),
        item.slots.map((s) => s.slot) as SlotNo[],
        now,
      ) === "pending",
  ).length;
}

export type TeacherListFilter = {
  status: ReservationStatus | null;
  start: string;
  end: string;
  roomId: string | null;
  /** From S13: only the approved reservations that touch this 使用止め. */
  block: (BlockRange & { roomId: string }) | null;
};

/** S11. By date range and room in the database; by state (期限切れ is computed) here. */
export async function listTeacherRows(
  filter: TeacherListFilter,
  today: string,
  now: Date,
  page: number,
): Promise<{ rows: ReservationRow[]; hasNext: boolean }> {
  const items = await getDb().reservation.findMany({
    where: {
      date: {
        gte: textToDateColumn(filter.start),
        lte: textToDateColumn(filter.end),
      },
      ...(filter.roomId ? { roomId: filter.roomId } : {}),
    },
    select: SELECT,
  });
  const selected = items
    .map((item) => ({
      item,
      date: dateColumnToText(item.date),
      slots: item.slots.map((s) => s.slot).sort((a, b) => a - b) as SlotNo[],
    }))
    .filter((p) => {
      if (filter.block) {
        return (
          p.item.status === "APPROVED" &&
          p.item.roomId === filter.block.roomId &&
          reservationInBlock(filter.block, p)
        );
      }
      return (
        filter.status === null ||
        effectiveStatus(toStored(p.item.status), p.date, p.slots, now) ===
          filter.status
      );
    })
    .sort(compareByStart);
  const start = (page - 1) * PAGE_SIZE;
  return {
    rows: await toRows(
      selected.slice(start, start + PAGE_SIZE).map((p) => p.item),
      today,
      now,
    ),
    hasNext: selected.length > start + PAGE_SIZE,
  };
}
