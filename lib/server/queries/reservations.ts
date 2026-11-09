import "server-only";
import type { ReservationRow } from "@/components/screens/reservation-lists";
import type { PeriodNo, SlotNo } from "@/lib/domain/periods";
import {
  blockedPeriodsOn,
  effectiveStatus,
  orderMine,
  reservationEndAt,
  slotRangeText,
  type BlockRange,
  type SlotReservation,
  type StoredReservationStatus,
} from "@/lib/domain/reservation-core";
import {
  dateColumnToText,
  formatDate,
  schoolDateTimeText,
  textToDateColumn,
} from "@/lib/domain/school-date";
import { getDb } from "../db";

// What the screens read out of 予約 and 使用止め (E14〜E16). Callers have checked who is signed in.

export const PAGE_SIZE = 50; // 一覧の件数 (6-3)

const STORED: Record<string, StoredReservationStatus> = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  WITHDRAWN: "withdrawn",
};

export const toStored = (status: string): StoredReservationStatus =>
  STORED[status];

const toSlots = (rows: { slot: number }[]) =>
  rows.map((row) => row.slot).sort((a, b) => a - b) as SlotNo[];

/**
 * 承認待ち and 承認済み of a day (the only ones that take a slot, R4-1), and the 使用止め that
 * reach the day. Rooms are told apart by id. One room only when `roomId` is given.
 */
export async function loadDayOverlays(
  date: string,
  roomId?: string,
): Promise<{
  reservations: Map<string, SlotReservation[]>;
  blockedPeriods: Map<string, Set<PeriodNo>>;
}> {
  const db = getDb();
  const day = textToDateColumn(date);
  const [reservations, blocks] = await Promise.all([
    db.reservation.findMany({
      where: {
        date: day,
        status: { in: ["PENDING", "APPROVED"] },
        ...(roomId ? { roomId } : {}),
      },
      select: {
        roomId: true,
        status: true,
        slots: { select: { slot: true } },
      },
    }),
    db.roomBlock.findMany({
      where: {
        startDate: { lte: day },
        endDate: { gte: day },
        ...(roomId ? { roomId } : {}),
      },
      select: {
        roomId: true,
        startDate: true,
        startPeriod: true,
        endDate: true,
        endPeriod: true,
      },
    }),
  ]);

  const byRoom = new Map<string, SlotReservation[]>();
  for (const row of reservations) {
    const list = byRoom.get(row.roomId) ?? [];
    list.push({
      status: toStored(row.status),
      date,
      slots: toSlots(row.slots),
    });
    byRoom.set(row.roomId, list);
  }

  const ranges = new Map<string, BlockRange[]>();
  for (const block of blocks) {
    const list = ranges.get(block.roomId) ?? [];
    list.push({
      startDate: dateColumnToText(block.startDate),
      startPeriod: block.startPeriod as PeriodNo,
      endDate: dateColumnToText(block.endDate),
      endPeriod: block.endPeriod as PeriodNo,
    });
    ranges.set(block.roomId, list);
  }
  const blockedPeriods = new Map<string, Set<PeriodNo>>();
  for (const [id, list] of ranges) {
    blockedPeriods.set(id, blockedPeriodsOn(list, date));
  }
  return { reservations: byRoom, blockedPeriods };
}

/** S07. The signed-in user's own reservations, in the order of the screen, one page. */
export async function listMyReservations(
  userId: string,
  today: string,
  now: Date,
  page: number,
): Promise<{ rows: ReservationRow[]; hasNext: boolean }> {
  const rows = await getDb().reservation.findMany({
    where: { applicantId: userId },
    select: {
      id: true,
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
    },
  });
  const items = rows.map((row) => ({
    row,
    date: dateColumnToText(row.date),
    slots: toSlots(row.slots),
  }));
  const ordered = orderMine(items, now);
  const start = (page - 1) * PAGE_SIZE;
  const shown = ordered.slice(start, start + PAGE_SIZE);
  return {
    rows: shown.map(({ row, date, slots }) => ({
      id: row.id,
      dateText: formatDate(date, today),
      slotText: slotRangeText(slots),
      room: row.room.name,
      purpose: row.purpose,
      note: row.note,
      applicant: row.applicantName,
      createdText: schoolDateTimeText(row.createdAt),
      status: effectiveStatus(toStored(row.status), date, slots, now),
      handledBy: row.handledByName,
      handledText: row.handledAt ? schoolDateTimeText(row.handledAt) : null,
      proxy: row.proxy,
      warnings: [],
      blockedReasons: [],
    })),
    hasNext: ordered.length > start + PAGE_SIZE,
  };
}

/** Is the reservation over (its last slot has ended)? For the lists. */
export const isOver = (date: string, slots: readonly SlotNo[], now: Date) =>
  reservationEndAt(date, slots) <= now;
