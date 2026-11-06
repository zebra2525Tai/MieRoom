import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildMasterData,
  MASTER_FILES,
  type MasterData,
  type MasterFileKey,
  type MasterFileTexts,
} from "@/lib/domain/master-csv";
import type { ExportSource } from "@/lib/domain/master-export";

const KEYS = Object.keys(MASTER_FILES) as MasterFileKey[];

export function demoTexts(): MasterFileTexts {
  const dir = join(process.cwd(), "demo-data", "master");
  return Object.fromEntries(
    KEYS.map((key) => [
      key,
      readFileSync(join(dir, MASTER_FILES[key]), "utf8"),
    ]),
  ) as MasterFileTexts;
}

/** The demo masters as rows of the database: everything active, every class this year. */
export function toSource(data: MasterData): ExportSource {
  return {
    rooms: data.rooms.map((room) => ({ ...room, active: true })),
    teachers: data.teachers.map((t) => ({ ...t, active: true })),
    subjects: data.subjects.map((s) => ({ ...s, active: true })),
    classes: data.classes.map((c) => ({
      name: c.name,
      homeRoom: c.homeRoom,
      subjects: data.classSubjects
        .filter((x) => x.className === c.name)
        .map((x) => x.subjectName),
      teachers: data.subjectTeachers
        .filter((x) => x.className === c.name)
        .map((x) => ({
          subjectName: x.subjectName,
          teacherName: x.teacherName,
        })),
      rooms: data.subjectRooms
        .filter((x) => x.className === c.name)
        .map((x) => ({ subjectName: x.subjectName, roomName: x.roomName })),
    })),
    closures: data.closures,
  };
}

export function demoSource(): ExportSource {
  const { data } = buildMasterData(demoTexts());
  return toSource(data!);
}
