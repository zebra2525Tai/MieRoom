import "server-only";
import { describeDeletion, nameMatches } from "@/lib/domain/deletion";
import { isMasterKind, type MasterKind } from "@/lib/domain/master-edit";
import { MESSAGES } from "@/lib/messages";
import { getDb } from "./db";
import { countUsage, type Client } from "./queries/deletion";
import { UUID } from "./reservations";

// S26 削除 (F22, R5-7). The route has checked the site, the sign-in, the 時間割管理者 role and
// that the sign-in is less than 5 minutes old. Here: it is inactive, the name typed is its name,
// and it is not used. The last two are checked again inside the transaction that deletes.

export type DeleteResult =
  | { kind: "deleted" }
  | { kind: "refused"; message: string }
  | { kind: "not_found" };

const isForeignKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code: unknown }).code === "P2003";

/** The name and whether it is still active, or null when there is no such row. */
async function find(db: Client, kind: MasterKind, id: string) {
  switch (kind) {
    case "classes": {
      const row = await db.schoolClass.findUnique({
        where: { id },
        select: { name: true, active: true },
      });
      return row;
    }
    case "subjects":
      return db.subject.findUnique({
        where: { id },
        select: { name: true, active: true },
      });
    case "rooms":
      return db.room.findUnique({
        where: { id },
        select: { name: true, active: true },
      });
    case "teachers": {
      const row = await db.teacher.findUnique({
        where: { id },
        select: { displayName: true, active: true },
      });
      return row ? { name: row.displayName, active: row.active } : null;
    }
  }
}

async function remove(db: Client, kind: MasterKind, id: string) {
  // Only a row that is still inactive: nobody has switched it on in the meantime.
  const where = { id, active: false };
  switch (kind) {
    case "classes":
      return (await db.schoolClass.deleteMany({ where })).count;
    case "subjects":
      return (await db.subject.deleteMany({ where })).count;
    case "rooms":
      return (await db.room.deleteMany({ where })).count;
    case "teachers":
      return (await db.teacher.deleteMany({ where })).count;
  }
}

export async function deleteMaster(
  kind: unknown,
  id: unknown,
  typedName: unknown,
  now: Date,
): Promise<DeleteResult> {
  if (!isMasterKind(kind) || typeof id !== "string" || !UUID.test(id)) {
    return { kind: "not_found" };
  }
  try {
    return await getDb().$transaction(async (tx): Promise<DeleteResult> => {
      const row = await find(tx, kind, id);
      if (row === null) return { kind: "not_found" };
      // 1. It was made inactive first. 4. The name typed is its name.
      if (!row.active) {
        if (!nameMatches(typedName, row.name)) {
          return { kind: "refused", message: MESSAGES.ME511 };
        }
      } else {
        return {
          kind: "refused",
          message: MESSAGES.ME512("有効になっています。先に無効にしてください"),
        };
      }
      // 3. It is not used (read again, inside the transaction).
      const view = describeDeletion(kind, await countUsage(tx, kind, id, now));
      if (view.reasons.length > 0) {
        return {
          kind: "refused",
          message: MESSAGES.ME512(view.reasons.join("、")),
        };
      }
      return (await remove(tx, kind, id)) === 1
        ? { kind: "deleted" }
        : { kind: "not_found" };
    });
  } catch (error) {
    // Something started to use it between the check and the delete: the database refuses.
    if (isForeignKeyError(error)) {
      return {
        kind: "refused",
        message: MESSAGES.ME512("ほかで使われています"),
      };
    }
    throw error;
  }
}
