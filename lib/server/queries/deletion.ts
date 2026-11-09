import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { DeletionCounts } from "@/lib/domain/deletion";
import { describeDeletion } from "@/lib/domain/deletion";
import type { MasterKind } from "@/lib/domain/master-edit";
import type { SlotNo } from "@/lib/domain/periods";
import {
  blockEndAt,
  effectiveStatus,
  reservationEndAt,
  type BlockRange,
} from "@/lib/domain/reservation-core";
import {
  dateColumnToText,
  schoolToday,
  textToDateColumn,
} from "@/lib/domain/school-date";
import { getDb } from "../db";

// What 削除管理 (S26) reads: the inactive masters, and for each how it is used (R5-7).
// Callers have checked that the user is a 時間割管理者.

export type Client = Prisma.TransactionClient;

const EMPTY: DeletionCounts = {
  futureLessons: 0,
  pastLessons: 0,
  links: 0,
  validReservations: 0,
  finishedReservations: 0,
  activeBlocks: 0,
  finishedBlocks: 0,
  receivers: 0,
  homeroomClasses: [],
  monthStatuses: 0,
  classClosures: 0,
  hasTag: false,
  hasLocation: false,
};

/** How an item is used and what goes with it. The one place that decides it (list and delete). */
export async function countUsage(
  db: Client,
  kind: MasterKind,
  id: string,
  now: Date,
): Promise<DeletionCounts> {
  const today = textToDateColumn(schoolToday(now));
  const before = { lt: today };
  const fromToday = { gte: today };

  switch (kind) {
    case "classes": {
      const [futureLessons, pastLessons, monthStatuses, classClosures] =
        await Promise.all([
          db.lesson.count({ where: { classId: id, date: fromToday } }),
          db.lesson.count({ where: { classId: id, date: before } }),
          db.monthStatus.count({ where: { classId: id } }),
          db.closure.count({ where: { classId: id } }),
        ]);
      return {
        ...EMPTY,
        futureLessons,
        pastLessons,
        monthStatuses,
        classClosures,
      };
    }
    case "subjects": {
      const [futureLessons, pastLessons, a, b, c] = await Promise.all([
        db.lesson.count({ where: { subjectId: id, date: fromToday } }),
        db.lesson.count({ where: { subjectId: id, date: before } }),
        db.classSubject.count({ where: { subjectId: id } }),
        db.subjectTeacher.count({ where: { subjectId: id } }),
        db.subjectRoom.count({ where: { subjectId: id } }),
      ]);
      return { ...EMPTY, futureLessons, pastLessons, links: a + b + c };
    }
    case "teachers": {
      const [futureLessons, pastLessons, links, teacher, location] =
        await Promise.all([
          db.lessonTeacher.count({
            where: { teacherId: id, lesson: { date: fromToday } },
          }),
          db.lessonTeacher.count({
            where: { teacherId: id, lesson: { date: before } },
          }),
          db.subjectTeacher.count({ where: { teacherId: id } }),
          db.teacher.findUnique({ where: { id }, select: { tagId: true } }),
          db.location.count({ where: { teacherId: id } }),
        ]);
      return {
        ...EMPTY,
        futureLessons,
        pastLessons,
        links,
        hasTag: teacher?.tagId != null,
        hasLocation: location > 0,
      };
    }
    case "rooms": {
      const [
        futureLessons,
        pastLessons,
        links,
        reservations,
        blocks,
        receivers,
        classes,
      ] = await Promise.all([
        db.lesson.count({ where: { roomId: id, date: fromToday } }),
        db.lesson.count({ where: { roomId: id, date: before } }),
        db.subjectRoom.count({ where: { roomId: id } }),
        db.reservation.findMany({
          where: { roomId: id },
          select: {
            date: true,
            status: true,
            slots: { select: { slot: true } },
          },
        }),
        db.roomBlock.findMany({
          where: { roomId: id },
          select: {
            startDate: true,
            startPeriod: true,
            endDate: true,
            endPeriod: true,
          },
        }),
        db.receiver.count({ where: { roomId: id } }),
        // Also the classes that have ended: the room is still written in them (R5-7).
        db.schoolClass.findMany({
          where: { homeRoomId: id },
          select: { name: true },
          orderBy: { name: "asc" },
        }),
      ]);

      // 有効な予約: waiting and not started, or approved and not over.
      const valid = reservations.filter((row) => {
        const date = dateColumnToText(row.date);
        const slots = row.slots.map((s) => s.slot) as SlotNo[];
        const stored = row.status;
        if (stored === "APPROVED") return reservationEndAt(date, slots) > now;
        if (stored === "PENDING") {
          return effectiveStatus("pending", date, slots, now) === "pending";
        }
        return false;
      }).length;
      const active = blocks.filter(
        (row) =>
          blockEndAt({
            startDate: dateColumnToText(row.startDate),
            startPeriod: row.startPeriod as BlockRange["startPeriod"],
            endDate: dateColumnToText(row.endDate),
            endPeriod: row.endPeriod as BlockRange["endPeriod"],
          }) > now,
      ).length;
      return {
        ...EMPTY,
        futureLessons,
        pastLessons,
        links,
        validReservations: valid,
        finishedReservations: reservations.length - valid,
        activeBlocks: active,
        finishedBlocks: blocks.length - active,
        receivers,
        homeroomClasses: classes.map((item) => item.name),
      };
    }
  }
}

export type DeletionRow = {
  id: string;
  name: string;
  canDelete: boolean;
  reasons: string[];
  impacts: string[];
};

/** The inactive items of one kind, with how each is used. */
export async function loadDeletionRows(
  kind: MasterKind,
  now: Date,
): Promise<DeletionRow[]> {
  const db = getDb();
  const items: { id: string; name: string }[] =
    kind === "classes"
      ? await db.schoolClass.findMany({
          where: { active: false },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : kind === "subjects"
        ? await db.subject.findMany({
            where: { active: false },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          })
        : kind === "rooms"
          ? await db.room.findMany({
              where: { active: false },
              select: { id: true, name: true },
              orderBy: { name: "asc" },
            })
          : (
              await db.teacher.findMany({
                where: { active: false },
                select: { id: true, displayName: true },
                orderBy: { displayName: "asc" },
              })
            ).map((row) => ({ id: row.id, name: row.displayName }));

  return Promise.all(
    items.map(async (item) => {
      const view = describeDeletion(
        kind,
        await countUsage(db, kind, item.id, now),
      );
      return {
        ...item,
        canDelete: view.reasons.length === 0,
        reasons: view.reasons,
        impacts: view.impacts,
      };
    }),
  );
}
