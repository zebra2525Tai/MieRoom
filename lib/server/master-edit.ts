import "server-only";
import {
  isMasterKind,
  PARSERS,
  type FieldError,
  type MasterKind,
} from "@/lib/domain/master-edit";
import { buildExport } from "@/lib/domain/master-export";
import {
  fiscalYearOfDate,
  schoolToday,
  textToDateColumn,
} from "@/lib/domain/school-date";
import { MESSAGES } from "@/lib/messages";
import { getDb } from "./db";
import { loadExportSource } from "./queries/export";
import { UUID } from "./reservations";

// S21 マスタ (F15). The route has checked the site, the sign-in and the 時間割管理者 role. Every
// value is checked here (R5-1〜R5-4); a name that is already taken is refused by the database
// too. A change is written only if the row is still the one the screen showed (ME902).

export type MasterResult =
  | {
      kind: "saved";
      notice: "MI501" | "MI502" | "MI502on";
      /** MW501: a name changed. Tell the 担任 to be given the CSVs again. */
      renamed: boolean;
      /** MW502: what is wrong for the CSV export, after this change. */
      exportIssues: number;
    }
  | { kind: "invalid"; errors: FieldError[] }
  | { kind: "conflict" }
  | { kind: "not_found" };

const isDuplicate = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code: unknown }).code === "P2002";

/** How many errors the export check (R5-6) finds now. Never stops a save. */
async function countExportIssues(now: Date): Promise<number> {
  try {
    const year = fiscalYearOfDate(schoolToday(now));
    const result = buildExport(await loadExportSource(year));
    return result.issues.filter((issue) => issue.level === "error").length;
  } catch {
    return 0;
  }
}

const parseVersion = (value: unknown): Date | null => {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time);
};

/** Is the name or e-mail taken by another row (also an inactive one)? */
async function takenBy(
  kind: MasterKind,
  value: { name?: string; displayName?: string; email?: string | null },
  selfId: string | null,
): Promise<FieldError[]> {
  const db = getDb();
  const other = selfId ? { id: { not: selfId } } : {};
  const errors: FieldError[] = [];
  switch (kind) {
    case "classes":
      if (
        await db.schoolClass.findFirst({
          where: { name: value.name, ...other },
          select: { id: true },
        })
      ) {
        errors.push({ field: "name", message: MESSAGES.ME502 });
      }
      break;
    case "subjects":
      if (
        await db.subject.findFirst({
          where: { name: value.name, ...other },
          select: { id: true },
        })
      ) {
        errors.push({ field: "name", message: MESSAGES.ME502 });
      }
      break;
    case "rooms":
      if (
        await db.room.findFirst({
          where: { name: value.name, ...other },
          select: { id: true },
        })
      ) {
        errors.push({ field: "name", message: MESSAGES.ME502 });
      }
      break;
    case "teachers": {
      const [byName, byEmail] = await Promise.all([
        db.teacher.findFirst({
          where: { displayName: value.displayName, ...other },
          select: { id: true },
        }),
        value.email
          ? db.teacher.findFirst({
              where: { email: value.email, ...other },
              select: { id: true },
            })
          : null,
      ]);
      if (byName)
        errors.push({ field: "displayName", message: MESSAGES.ME502 });
      if (byEmail) errors.push({ field: "email", message: MESSAGES.ME507 });
      break;
    }
  }
  return errors;
}

/**
 * 追加 (no `id`) or 編集 (`id` and `version`, the updatedAt the screen showed).
 * Renaming a room, a subject or a teacher also renames it in the lessons from today on (R5-3);
 * past lessons keep the name of their day.
 */
export async function saveMaster(
  kind: unknown,
  raw: unknown,
  now: Date,
): Promise<MasterResult> {
  if (!isMasterKind(kind)) return { kind: "not_found" };
  const body =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  const id = body.id === undefined || body.id === null ? null : body.id;
  if (id !== null && (typeof id !== "string" || !UUID.test(id))) {
    return { kind: "not_found" };
  }

  const parsed = PARSERS[kind](body);
  if (!parsed.ok) return { kind: "invalid", errors: parsed.errors };
  const value = parsed.value as Record<string, unknown> & {
    name?: string;
    displayName?: string;
    email?: string | null;
  };

  const db = getDb();
  const errors = await takenBy(kind, value, id);
  if (kind === "classes") {
    const room = await db.room.findFirst({
      where: { id: String(value.homeRoomId), active: true },
      select: { id: true },
    });
    if (!UUID.test(String(value.homeRoomId)) || room === null) {
      errors.push({ field: "homeRoomId", message: MESSAGES.ME706 });
    }
  }
  if (errors.length > 0) return { kind: "invalid", errors };

  const today = textToDateColumn(schoolToday(now));
  try {
    let renamed = false;
    if (id === null) {
      await create(kind, value);
    } else {
      const version = parseVersion(body.version);
      if (version === null) return { kind: "conflict" };
      const result = await update(kind, id, version, value, today);
      if (result === "gone") return { kind: "not_found" };
      if (result === "conflict") return { kind: "conflict" };
      renamed = result === "renamed";
    }
    return {
      kind: "saved",
      notice: "MI501",
      renamed,
      exportIssues: await countExportIssues(now),
    };
  } catch (error) {
    // Somebody took the name between the check and the write.
    if (isDuplicate(error)) {
      return {
        kind: "invalid",
        errors: [
          {
            field: kind === "teachers" ? "displayName" : "name",
            message: MESSAGES.ME502,
          },
        ],
      };
    }
    throw error;
  }
}

async function create(kind: MasterKind, value: Record<string, unknown>) {
  const db = getDb();
  switch (kind) {
    case "classes":
      await db.schoolClass.create({
        data: {
          name: String(value.name),
          homeRoomId: String(value.homeRoomId),
          startYear: Number(value.startYear),
          endYear: value.endYear === null ? null : Number(value.endYear),
        },
      });
      return;
    case "subjects":
      await db.subject.create({ data: { name: String(value.name) } });
      return;
    case "rooms":
      await db.room.create({
        data: {
          name: String(value.name),
          building: value.building as string | null,
          kind: value.kind as "HOMEROOM" | "FREE",
          note: value.note as string | null,
        },
      });
      return;
    case "teachers":
      await db.teacher.create({
        data: {
          displayName: String(value.displayName),
          email: value.email as string | null,
        },
      });
  }
}

/** "renamed": saved and a name changed; "saved": saved; "conflict": the row changed meanwhile. */
async function update(
  kind: MasterKind,
  id: string,
  version: Date,
  value: Record<string, unknown>,
  today: Date,
): Promise<"renamed" | "saved" | "conflict" | "gone"> {
  const db = getDb();
  return db.$transaction(async (tx) => {
    const guard = { id, updatedAt: version };
    let count = 0;
    let oldName: string | null = null;
    let newName: string | null = null;

    switch (kind) {
      case "classes":
        // A class name is not copied into lessons (they point at the class), so only the
        // warning (MW501) depends on it.
        oldName =
          (
            await tx.schoolClass.findUnique({
              where: { id },
              select: { name: true },
            })
          )?.name ?? null;
        newName = String(value.name);
        count = (
          await tx.schoolClass.updateMany({
            where: guard,
            data: {
              name: newName,
              homeRoomId: String(value.homeRoomId),
              startYear: Number(value.startYear),
              endYear: value.endYear === null ? null : Number(value.endYear),
            },
          })
        ).count;
        break;
      case "subjects": {
        oldName =
          (
            await tx.subject.findUnique({
              where: { id },
              select: { name: true },
            })
          )?.name ?? null;
        newName = String(value.name);
        count = (
          await tx.subject.updateMany({ where: guard, data: { name: newName } })
        ).count;
        if (count === 1 && oldName !== newName) {
          await tx.lesson.updateMany({
            where: { subjectId: id, date: { gte: today } },
            data: { subjectName: newName },
          });
        }
        break;
      }
      case "rooms": {
        oldName =
          (await tx.room.findUnique({ where: { id }, select: { name: true } }))
            ?.name ?? null;
        newName = String(value.name);
        count = (
          await tx.room.updateMany({
            where: guard,
            data: {
              name: newName,
              building: value.building as string | null,
              kind: value.kind as "HOMEROOM" | "FREE",
              note: value.note as string | null,
            },
          })
        ).count;
        if (count === 1 && oldName !== newName) {
          await tx.lesson.updateMany({
            where: { roomId: id, date: { gte: today } },
            data: { roomName: newName },
          });
        }
        break;
      }
      case "teachers": {
        oldName =
          (
            await tx.teacher.findUnique({
              where: { id },
              select: { displayName: true },
            })
          )?.displayName ?? null;
        newName = String(value.displayName);
        count = (
          await tx.teacher.updateMany({
            where: guard,
            data: { displayName: newName, email: value.email as string | null },
          })
        ).count;
        if (count === 1 && oldName !== newName) {
          await tx.lessonTeacher.updateMany({
            where: { teacherId: id, lesson: { date: { gte: today } } },
            data: { teacherName: newName },
          });
        }
        break;
      }
    }

    if (count === 1) {
      // The name of a class is not copied anywhere: lessons point at the class.
      return oldName !== null && newName !== null && oldName !== newName
        ? "renamed"
        : "saved";
    }
    return (await exists(tx, kind, id)) ? "conflict" : "gone";
  });
}

type Tx = Parameters<
  Parameters<ReturnType<typeof getDb>["$transaction"]>[0]
>[0];

async function exists(tx: Tx, kind: MasterKind, id: string): Promise<boolean> {
  switch (kind) {
    case "classes":
      return (await tx.schoolClass.count({ where: { id } })) > 0;
    case "subjects":
      return (await tx.subject.count({ where: { id } })) > 0;
    case "rooms":
      return (await tx.room.count({ where: { id } })) > 0;
    case "teachers":
      return (await tx.teacher.count({ where: { id } })) > 0;
  }
}

/** 無効にする / 有効に戻す. Disabling asks first on the screen (MC501); enabling does not. */
export async function setMasterActive(
  kind: unknown,
  id: unknown,
  active: unknown,
  now: Date,
): Promise<MasterResult> {
  if (!isMasterKind(kind) || typeof id !== "string" || !UUID.test(id)) {
    return { kind: "not_found" };
  }
  if (typeof active !== "boolean") return { kind: "not_found" };
  const db = getDb();
  const where = { id };
  const data = { active };
  const count = (
    kind === "classes"
      ? await db.schoolClass.updateMany({ where, data })
      : kind === "subjects"
        ? await db.subject.updateMany({ where, data })
        : kind === "rooms"
          ? await db.room.updateMany({ where, data })
          : await db.teacher.updateMany({ where, data })
  ).count;
  if (count !== 1) return { kind: "not_found" };
  return {
    kind: "saved",
    notice: active ? "MI502on" : "MI502",
    renamed: false,
    exportIssues: await countExportIssues(now),
  };
}
