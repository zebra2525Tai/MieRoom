import "server-only";
import { randomBytes } from "node:crypto";
import {
  PLAN_ROOM_NAMES,
  type RoomState,
  type RoomStates,
} from "@/lib/domain/floor-plan";
import {
  displayPeriodNo,
  displaySlotNo,
  isPassphraseShape,
  MONITOR_NAME_MAX,
  monitorChips,
  monitorPhase,
  type MonitorChips,
} from "@/lib/domain/monitor";
import { PERIODS, toMinutes } from "@/lib/domain/periods";
import { slotStatuses } from "@/lib/domain/reservation-core";
import { ALL_FREE } from "@/lib/domain/room-status";
import {
  fiscalYearOfDate,
  schoolMinutes,
  schoolToday,
  textToDateColumn,
} from "@/lib/domain/school-date";
import { MESSAGES } from "@/lib/messages";
import { getDb } from "./db";
import { inYear } from "./queries/common";
import { loadDayOverlays } from "./queries/reservations";
import { UUID } from "./reservations";

// S30 モニター と S27 モニターURL (外部設計書 06-3, 06-4, 11章 E18)。
// モニターは、ログインなしで、合言葉つきの URL で開く。見せるのは、教室の使用状況 (クラス名・
// 教科・先生の名前・予約使用中)だけ。予約の用途・申請者、先生の位置は、ここでは読まない。

// ---- 画面に出すデータ -------------------------------------------------------------

export type MonitorScreenData = {
  chips: MonitorChips;
  states: RoomStates;
  /** データを取った時刻 (ISO)。最終更新の表示に使う */
  updatedAt: string;
};

const collator = new Intl.Collator("ja");

/** 合同の授業 (同じ教室に複数のクラス) は、名前をまとめて 1 つにする。 */
function joinUnique(values: string[], separator: string): string {
  return [...new Set(values)].sort(collator.compare).join(separator);
}

/**
 * いま (休み時間は次の時限) の、図の教室ごとの状態。順番は R4-1: 使用止め、授業、予約済み。
 * 仮予約・空きは「空き」。休講と、教室未定の授業は出ない。授業は、今日の年度に存在していて有効な
 * クラスのものだけ (R6-3)。
 */
export async function loadMonitorScreen(
  now: Date = new Date(),
): Promise<MonitorScreenData> {
  const phase = monitorPhase(schoolMinutes(now));
  const chips = monitorChips(phase);
  const periodNo = displayPeriodNo(phase);
  const slotNo = displaySlotNo(phase);
  const isNext = phase.kind === "break";
  const today = schoolToday(now);

  const db = getDb();
  const rooms = await db.room.findMany({
    where: { active: true, name: { in: [...PLAN_ROOM_NAMES] } },
    select: { id: true, name: true },
  });

  const states: Record<string, RoomState> = {};
  if (periodNo === null || slotNo === null) {
    // 本日の授業は終わった: 図の教室は、すべて空き
    for (const room of rooms) states[room.name] = { kind: "free" };
    return { chips, states, updatedAt: now.toISOString() };
  }

  const year = fiscalYearOfDate(today);
  const period = PERIODS[periodNo - 1];
  const [lessons, overlays] = await Promise.all([
    db.lesson.findMany({
      where: {
        date: textToDateColumn(today),
        startMinutes: toMinutes(period.start),
        roomId: { in: rooms.map((room) => room.id) },
        cancelled: false,
        class: inYear(year),
      },
      select: {
        roomId: true,
        subjectName: true,
        class: { select: { name: true } },
        teachers: { select: { teacherName: true } },
      },
    }),
    loadDayOverlays(today),
  ]);

  const byRoom = new Map<
    string,
    { classes: string[]; subjects: string[]; teachers: string[] }
  >();
  for (const lesson of lessons) {
    if (lesson.roomId === null) continue;
    const entry = byRoom.get(lesson.roomId) ?? {
      classes: [],
      subjects: [],
      teachers: [],
    };
    entry.classes.push(lesson.class.name);
    entry.subjects.push(lesson.subjectName);
    entry.teachers.push(...lesson.teachers.map((t) => t.teacherName));
    byRoom.set(lesson.roomId, entry);
  }

  for (const room of rooms) {
    const slot = slotStatuses({
      lessonSlots: ALL_FREE,
      blockedPeriods: overlays.blockedPeriods.get(room.id),
      reservations: overlays.reservations.get(room.id),
      now,
    })[slotNo];
    const lesson = byRoom.get(room.id);
    if (slot.kind === "blocked") {
      states[room.name] = { kind: "blocked" };
    } else if (lesson !== undefined) {
      states[room.name] = {
        kind: "lesson",
        next: isNext,
        className: joinUnique(lesson.classes, "・"),
        subject: joinUnique(lesson.subjects, "・"),
        // 講師の行がない授業は「各担当」(E11)
        teacher:
          lesson.teachers.length === 0
            ? "各担当"
            : joinUnique(lesson.teachers, "、"),
      };
    } else if (slot.kind === "reserved") {
      states[room.name] = { kind: "reserved" };
    } else {
      states[room.name] = { kind: "free" };
    }
  }
  return { chips, states, updatedAt: now.toISOString() };
}

// ---- 合言葉 (E18) -------------------------------------------------------------------

/** 24バイトの乱数 = 32文字 (A-Z a-z 0-9 - _)。03章 3-6: 推測できない長さ (32文字以上)。 */
export function createPassphrase(): string {
  return randomBytes(24).toString("base64url");
}

/** 有効な合言葉か。形が違えば、DB に問い合わせない。違う・無効なら null (S91)。 */
export async function findActiveMonitor(
  passphrase: unknown,
): Promise<{ id: string; name: string } | null> {
  if (!isPassphraseShape(passphrase)) return null;
  return getDb().monitor.findFirst({
    where: { passphrase, active: true },
    select: { id: true, name: true },
  });
}

// ---- S27 モニターURL ------------------------------------------------------------------

export type MonitorRow = {
  id: string;
  name: string;
  passphrase: string;
  active: boolean;
  createdAt: string;
};

/** S27 の一覧。合言葉は、この画面でだけ見られる (時間割管理者だけが開ける)。 */
export async function listMonitors(): Promise<MonitorRow[]> {
  const rows = await getDb().monitor.findMany({
    select: {
      id: true,
      name: true,
      passphrase: true,
      active: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

export type MonitorResult =
  | { kind: "done"; notice: "MI501" | "MI502" | "MI502on" }
  | { kind: "invalid"; message: string }
  | { kind: "not_found" };

const isDuplicate = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code: unknown }).code === "P2002";

/** 追加: 名前を入れると、合言葉を作る。名前は 20 文字まで・必須。 */
export async function addMonitor(rawName: unknown): Promise<MonitorResult> {
  if (typeof rawName !== "string") return { kind: "not_found" };
  const name = rawName.trim();
  if (name === "") return { kind: "invalid", message: MESSAGES.ME501 };
  if ([...name].length > MONITOR_NAME_MAX) {
    return { kind: "invalid", message: MESSAGES.ME504(MONITOR_NAME_MAX) };
  }
  // 合言葉が (ほぼありえないが) 重なったら、もう一度作る
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await getDb().monitor.create({
        data: { name, passphrase: createPassphrase() },
      });
      return { kind: "done", notice: "MI501" };
    } catch (error) {
      if (!isDuplicate(error)) throw error;
    }
  }
  throw new Error("could not create a unique passphrase");
}

/** 合言葉を変える: 新しい合言葉を作り、古い URL はすぐに使えなくなる。 */
export async function rotateMonitor(id: unknown): Promise<MonitorResult> {
  if (typeof id !== "string" || !UUID.test(id)) return { kind: "not_found" };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const done = await getDb().monitor.updateMany({
        where: { id },
        data: { passphrase: createPassphrase() },
      });
      return done.count === 0
        ? { kind: "not_found" }
        : { kind: "done", notice: "MI501" };
    } catch (error) {
      if (!isDuplicate(error)) throw error;
    }
  }
  throw new Error("could not create a unique passphrase");
}

/** 無効にする / 有効に戻す。無効の URL は S91 になる。 */
export async function setMonitorActive(
  id: unknown,
  active: unknown,
): Promise<MonitorResult> {
  if (typeof id !== "string" || !UUID.test(id) || typeof active !== "boolean") {
    return { kind: "not_found" };
  }
  const done = await getDb().monitor.updateMany({
    where: { id },
    data: { active },
  });
  return done.count === 0
    ? { kind: "not_found" }
    : { kind: "done", notice: active ? "MI502on" : "MI502" };
}
