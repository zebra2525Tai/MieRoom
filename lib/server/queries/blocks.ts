import "server-only";
import type { BlockRow } from "@/components/screens/blocks-view";
import type { PeriodNo, SlotNo } from "@/lib/domain/periods";
import {
  blockEndAt,
  lessonInBlock,
  reservationInBlock,
  type BlockRange,
} from "@/lib/domain/reservation-core";
import {
  dateColumnToText,
  formatDate,
  schoolDateTimeText,
  textToDateColumn,
} from "@/lib/domain/school-date";
import { getDb } from "../db";
import { UUID } from "../reservations";

// 使用止め for S13 and S11 (E16). Callers have checked that the user is a 先生.

const range = (block: {
  startDate: Date;
  startPeriod: number;
  endDate: Date;
  endPeriod: number;
}): BlockRange => ({
  startDate: dateColumnToText(block.startDate),
  startPeriod: block.startPeriod as PeriodNo,
  endDate: dateColumnToText(block.endDate),
  endPeriod: block.endPeriod as PeriodNo,
});

/** One 使用止め by id (from S13 to S11). null when the id is not one. */
export async function findBlock(
  id: string | undefined,
): Promise<(BlockRange & { roomId: string }) | null> {
  if (id === undefined || !UUID.test(id)) return null;
  const block = await getDb().roomBlock.findUnique({
    where: { id },
    select: {
      roomId: true,
      startDate: true,
      startPeriod: true,
      endDate: true,
      endPeriod: true,
    },
  });
  return block ? { ...range(block), roomId: block.roomId } : null;
}

/** S13 「終わっていない使用止め」 with how many approved reservations and lessons each touches. */
export async function listBlocks(
  today: string,
  now: Date,
): Promise<BlockRow[]> {
  const db = getDb();
  const blocks = await db.roomBlock.findMany({
    where: { endDate: { gte: textToDateColumn(today) } },
    select: {
      id: true,
      roomId: true,
      startDate: true,
      startPeriod: true,
      endDate: true,
      endPeriod: true,
      setByName: true,
      createdAt: true,
      room: { select: { name: true } },
    },
    orderBy: [{ startDate: "asc" }, { startPeriod: "asc" }],
  });
  const active = blocks.filter((block) => blockEndAt(range(block)) > now);
  if (active.length === 0) return [];

  const roomIds = [...new Set(active.map((b) => b.roomId))];
  const from = active.map((b) => b.startDate).sort((a, b) => +a - +b)[0];
  const to = active.map((b) => b.endDate).sort((a, b) => +b - +a)[0];
  const [reservations, lessons] = await Promise.all([
    db.reservation.findMany({
      where: {
        roomId: { in: roomIds },
        status: "APPROVED",
        date: { gte: from, lte: to },
      },
      select: { roomId: true, date: true, slots: { select: { slot: true } } },
    }),
    db.lesson.findMany({
      where: {
        roomId: { in: roomIds },
        cancelled: false,
        date: { gte: from, lte: to },
      },
      select: {
        roomId: true,
        date: true,
        startMinutes: true,
        endMinutes: true,
      },
    }),
  ]);

  return active.map((block) => {
    const r = range(block);
    return {
      id: block.id,
      roomId: block.roomId,
      room: block.room.name,
      rangeText: `${formatDate(r.startDate, today)} ${r.startPeriod}限 〜 ${formatDate(r.endDate, today)} ${r.endPeriod}限`,
      setBy: block.setByName,
      setText: schoolDateTimeText(block.createdAt),
      overlapReservations: reservations.filter(
        (x) =>
          x.roomId === block.roomId &&
          reservationInBlock(r, {
            date: dateColumnToText(x.date),
            slots: x.slots.map((s) => s.slot) as SlotNo[],
          }),
      ).length,
      overlapLessons: lessons.filter(
        (x) =>
          x.roomId === block.roomId &&
          lessonInBlock(r, {
            date: dateColumnToText(x.date),
            startMinutes: x.startMinutes,
            endMinutes: x.endMinutes,
            cancelled: false,
          }),
      ).length,
    };
  });
}
