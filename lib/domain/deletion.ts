import type { MasterKind } from "./master-edit";

// 削除管理 (外部設計書 R5-7, S26). What keeps a master from being deleted, and what a deletion
// takes with it. No I/O here: the screens and the server give it the counts.

export type DeletionCounts = {
  /** Lessons from today on that point at it (a room, a subject, a teacher, a class). */
  futureLessons: number;
  /** Lessons before today that point at it. */
  pastLessons: number;
  /** 紐づけ: rows of the class/subject/teacher/room tables that use it. */
  links: number;
  /** 有効な予約: waiting (not started) or approved (not over). Rooms only. */
  validReservations: number;
  /** Reservations that are over or closed. They go with the room. */
  finishedReservations: number;
  /** 終わっていない使用止め. Rooms only. */
  activeBlocks: number;
  /** 終わった使用止め. They go with the room. */
  finishedBlocks: number;
  receivers: number;
  /** Classes (also ended ones) that have the room as their homeroom. */
  homeroomClasses: string[];
  /** Classes only: the import status rows and the class's own closures. */
  monthStatuses: number;
  classClosures: number;
  /** Teachers only. */
  hasTag: boolean;
  hasLocation: boolean;
};

export type DeletionView = {
  /** Why it cannot be deleted. Empty: it can (once it is inactive). */
  reasons: string[];
  /** What goes with it, or what changes (shown in the window, MC502). */
  impacts: string[];
};

/** 使われている (R5-7 3). */
function reasonsFor(kind: MasterKind, counts: DeletionCounts): string[] {
  const reasons: string[] = [];
  if (counts.futureLessons > 0) {
    reasons.push(`今日以降の授業${counts.futureLessons}件`);
  }
  if (kind === "subjects" || kind === "teachers" || kind === "rooms") {
    if (counts.links > 0) reasons.push(`紐づけ${counts.links}件`);
  }
  if (kind === "rooms") {
    if (counts.validReservations > 0) {
      reasons.push(`有効な予約${counts.validReservations}件`);
    }
    if (counts.activeBlocks > 0) {
      reasons.push(`使用止め${counts.activeBlocks}件`);
    }
    if (counts.homeroomClasses.length > 0) {
      reasons.push(`ホームルーム教室(${counts.homeroomClasses.join("、")})`);
    }
  }
  return reasons;
}

/** 削除したときの影響 (S26). */
function impactsFor(kind: MasterKind, counts: DeletionCounts): string[] {
  const impacts: string[] = [];
  switch (kind) {
    case "classes":
      impacts.push(`過去の授業${counts.pastLessons}件も消える`);
      if (counts.monthStatuses > 0) {
        impacts.push(`取り込みの状況${counts.monthStatuses}件も消える`);
      }
      if (counts.classClosures > 0) {
        impacts.push(`クラスごとの休み・行事${counts.classClosures}件も消える`);
      }
      break;
    case "subjects":
      impacts.push(`過去の授業${counts.pastLessons}件は名前だけ残る`);
      break;
    case "teachers":
      impacts.push(`過去の授業${counts.pastLessons}件は名前だけ残る`);
      impacts.push(
        `${counts.hasLocation ? "位置と" : ""}${counts.hasTag ? "タグも" : "登録も"}消える。その人は先生ではなくなる`,
      );
      break;
    case "rooms":
      impacts.push(`過去の授業${counts.pastLessons}件は名前だけ残る`);
      impacts.push(
        `終わった予約${counts.finishedReservations}件・終わった使用止め${counts.finishedBlocks}件も一緒に消える`,
      );
      if (counts.receivers > 0) {
        impacts.push(`受信機の登録${counts.receivers}件も消える`);
      }
      break;
  }
  return impacts;
}

export function describeDeletion(
  kind: MasterKind,
  counts: DeletionCounts,
): DeletionView {
  return {
    reasons: reasonsFor(kind, counts),
    impacts: impactsFor(kind, counts),
  };
}

/** The name typed in the window must be the name, as written (R5-7 4). Only the ends are trimmed. */
export function nameMatches(typed: unknown, name: string): boolean {
  return typeof typed === "string" && typed.trim() === name;
}
