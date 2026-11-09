import "server-only";
import { parseClosure } from "@/lib/domain/closure-edit";
import type { FieldError } from "@/lib/domain/master-edit";
import { fiscalYearOfDate, textToDateColumn } from "@/lib/domain/school-date";
import { MESSAGES } from "@/lib/messages";
import { getDb } from "./db";
import { countExportIssues } from "./master-edit";
import { inYear } from "./queries/common";
import { UUID } from "./reservations";

// S23 休み・行事 (F17). The route has checked the site, the sign-in and the 時間割管理者 role.
// Only the rows made in the system can be changed or deleted; the rows from the tool are
// replaced by importing that class and month (R3-10). The whole-school rows decide the 営業日
// (R4-3), so a change here moves the deadline of an application at once.

export type ClosureResult =
  | { kind: "saved"; exportIssues: number }
  | { kind: "invalid"; errors: FieldError[] }
  | { kind: "conflict" }
  | { kind: "not_found" };

const parseVersion = (value: unknown): Date | null => {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time);
};

/** 追加 (no `id`) or 編集 (`id` and `version`, the updatedAt the screen showed). */
export async function saveClosure(
  raw: unknown,
  now: Date,
): Promise<ClosureResult> {
  const body =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  const id = body.id === undefined || body.id === null ? null : body.id;
  if (id !== null && (typeof id !== "string" || !UUID.test(id))) {
    return { kind: "not_found" };
  }
  const parsed = parseClosure(body);
  if (!parsed.ok) return { kind: "invalid", errors: parsed.errors };
  const { startDate, endDate, name, classId } = parsed.value;

  const db = getDb();
  // A class of the school year the closure starts in, and still active.
  if (classId !== null) {
    const found = UUID.test(classId)
      ? await db.schoolClass.findFirst({
          where: { id: classId, ...inYear(fiscalYearOfDate(startDate)) },
          select: { id: true },
        })
      : null;
    if (found === null) {
      return {
        kind: "invalid",
        errors: [{ field: "classId", message: MESSAGES.ME706 }],
      };
    }
  }

  const data = {
    startDate: textToDateColumn(startDate),
    endDate: endDate === null ? null : textToDateColumn(endDate),
    name,
    classId,
  };
  if (id === null) {
    await db.closure.create({ data: { ...data, source: "SYSTEM" } });
  } else {
    const version = parseVersion(body.version);
    if (version === null) return { kind: "conflict" };
    const changed = await db.closure.updateMany({
      where: { id, source: "SYSTEM", updatedAt: version },
      data,
    });
    if (changed.count !== 1) {
      const row = await db.closure.findFirst({
        where: { id, source: "SYSTEM" },
        select: { id: true },
      });
      return row === null ? { kind: "not_found" } : { kind: "conflict" };
    }
  }
  return { kind: "saved", exportIssues: await countExportIssues(now) };
}

/** 削除 of a row made in the system (the screen asked first). */
export async function deleteClosure(
  id: unknown,
  now: Date,
): Promise<ClosureResult> {
  if (typeof id !== "string" || !UUID.test(id)) return { kind: "not_found" };
  const removed = await getDb().closure.deleteMany({
    where: { id, source: "SYSTEM" },
  });
  return removed.count === 1
    ? { kind: "saved", exportIssues: await countExportIssues(now) }
    : { kind: "not_found" };
}
