import "server-only";
import {
  masterExportRange,
  type ExportSource,
} from "@/lib/domain/master-export";
import { dateColumnToText } from "@/lib/domain/school-date";
import { getDb } from "../db";
import { inYear, overlapping } from "./common";

// What the CSV export (S24) reads: the master data of one school year, in the shape of
// ExportSource. Callers check the admin role first. Only names, never e-mail or tag IDs.
export async function loadExportSource(year: number): Promise<ExportSource> {
  const db = getDb();
  const range = masterExportRange(year);
  const [rooms, teachers, subjects, classes, closures] = await Promise.all([
    db.room.findMany({
      select: {
        name: true,
        building: true,
        kind: true,
        note: true,
        active: true,
      },
    }),
    db.teacher.findMany({ select: { displayName: true, active: true } }),
    db.subject.findMany({ select: { name: true, active: true } }),
    db.schoolClass.findMany({
      where: inYear(year),
      select: {
        name: true,
        homeRoom: { select: { name: true } },
        subjects: { select: { subject: { select: { name: true } } } },
        subjectTeachers: {
          select: {
            subject: { select: { name: true } },
            teacher: { select: { displayName: true } },
          },
        },
        subjectRooms: {
          select: {
            subject: { select: { name: true } },
            room: { select: { name: true } },
          },
        },
      },
    }),
    db.closure.findMany({
      where: { source: "SYSTEM", ...overlapping(range.start, range.end) },
      select: {
        startDate: true,
        endDate: true,
        name: true,
        class: { select: { name: true } },
      },
    }),
  ]);

  return {
    rooms,
    teachers,
    subjects,
    classes: classes.map((item) => ({
      name: item.name,
      homeRoom: item.homeRoom.name,
      subjects: item.subjects.map((row) => row.subject.name),
      teachers: item.subjectTeachers.map((row) => ({
        subjectName: row.subject.name,
        teacherName: row.teacher?.displayName ?? null,
      })),
      rooms: item.subjectRooms.map((row) => ({
        subjectName: row.subject.name,
        roomName: row.room?.name ?? null,
      })),
    })),
    closures: closures.map((row) => ({
      startDate: dateColumnToText(row.startDate),
      endDate: row.endDate ? dateColumnToText(row.endDate) : null,
      name: row.name,
      className: row.class?.name ?? null,
    })),
  };
}
