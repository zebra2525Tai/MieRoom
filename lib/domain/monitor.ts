import {
  PERIODS,
  SLOTS,
  toMinutes,
  type PeriodNo,
  type SlotNo,
} from "./periods";

// S30 モニター (外部設計書 06-4)。時刻から「いま授業中か、休み時間か、終わったか」を決める。
// I/O はなく、時刻は日本時間の「0時からの分」で受け取る (R2-1)。

export type MonitorPhase =
  /** いま、時限の中。slotNo は、いまの枠 (前半・後半) */
  | {
      kind: "lesson";
      periodNo: PeriodNo;
      slotNo: SlotNo;
      nextPeriodNo: PeriodNo | null;
    }
  /** 休み時間・昼休み・最初の授業の前。次の時限の授業を出す */
  | { kind: "break"; nextPeriodNo: PeriodNo }
  /** 4限が終わったあと */
  | { kind: "ended" };

export function monitorPhase(minutes: number): MonitorPhase {
  for (const period of PERIODS) {
    const start = toMinutes(period.start);
    const end = toMinutes(period.end);
    if (minutes < start) return { kind: "break", nextPeriodNo: period.no };
    if (minutes < end) {
      const slot = SLOTS.find(
        (item) =>
          item.periodNo === period.no &&
          minutes >= toMinutes(item.start) &&
          minutes < toMinutes(item.end),
      );
      return {
        kind: "lesson",
        periodNo: period.no,
        slotNo: (slot?.no ?? (period.no - 1) * 2 + 1) as SlotNo,
        nextPeriodNo: period.no === 4 ? null : ((period.no + 1) as PeriodNo),
      };
    }
  }
  return { kind: "ended" };
}

/** 上の帯のラベル。授業中: いま / 次。休み時間: 休み時間 / 次は。終わったあと: 終了。 */
export type MonitorChips = {
  primary: { tone: "lesson" | "break" | "ended"; text: string };
  secondary: string | null;
};

const periodOf = (no: PeriodNo) => PERIODS[no - 1];

export function monitorChips(phase: MonitorPhase): MonitorChips {
  switch (phase.kind) {
    case "lesson": {
      const now = periodOf(phase.periodNo);
      const next =
        phase.nextPeriodNo === null ? null : periodOf(phase.nextPeriodNo);
      return {
        primary: {
          tone: "lesson",
          text: `いま ${now.label} ${now.start}〜${now.end}`,
        },
        secondary:
          next === null
            ? "本日はこの授業が最後"
            : `次 ${next.label} ${next.start}`,
      };
    }
    case "break": {
      const next = periodOf(phase.nextPeriodNo);
      return {
        primary: { tone: "break", text: "休み時間" },
        secondary: `次は ${next.label} ${next.start}`,
      };
    }
    case "ended":
      return {
        primary: { tone: "ended", text: "本日の授業は終了" },
        secondary: null,
      };
  }
}

/**
 * 画面に出す授業の時限。授業中はいまの時限、休み時間は次の時限。
 * 終わったあとは null (授業は出さない)。
 */
export function displayPeriodNo(phase: MonitorPhase): PeriodNo | null {
  switch (phase.kind) {
    case "lesson":
      return phase.periodNo;
    case "break":
      return phase.nextPeriodNo;
    case "ended":
      return null;
  }
}

/**
 * 画面に出す枠 (予約・使用止めの判定に使う)。授業中はいまの枠、休み時間は次の時限の前半、
 * 終わったあとは null。
 */
export function displaySlotNo(phase: MonitorPhase): SlotNo | null {
  switch (phase.kind) {
    case "lesson":
      return phase.slotNo;
    case "break":
      return ((phase.nextPeriodNo - 1) * 2 + 1) as SlotNo;
    case "ended":
      return null;
  }
}

// ---- データを取りに行く時刻 (06-4 更新) ---------------------------------------
// 毎日 8:00 と、枠の境目の数秒後。1日13回。

export const REFRESH_DELAY_SECONDS = 5;

export const REFRESH_MINUTES: readonly number[] = [
  8 * 60,
  ...[...new Set(SLOTS.flatMap((s) => [toMinutes(s.start), toMinutes(s.end)]))],
].sort((a, b) => a - b);

/**
 * 次にデータを取りに行く時刻までの秒数。`seconds` は、日本時間の 0時からの秒。
 * 今日の最後の時刻を過ぎていれば、翌日の最初 (8:00) まで。
 */
export function secondsUntilNextRefresh(seconds: number): number {
  for (const minutes of REFRESH_MINUTES) {
    const at = minutes * 60 + REFRESH_DELAY_SECONDS;
    if (at > seconds) return at - seconds;
  }
  return 24 * 3600 - seconds + REFRESH_MINUTES[0] * 60 + REFRESH_DELAY_SECONDS;
}

// ---- 合言葉 (E18) --------------------------------------------------------------

/** 合言葉は、推測できない長さ (32文字以上。03章 3-6、12章)。 */
export const PASSPHRASE_MIN_LENGTH = 32;

/** URL に入っている値が、合言葉の形か (形が違えば、DB に問い合わせない)。 */
export function isPassphraseShape(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= PASSPHRASE_MIN_LENGTH &&
    value.length <= 64 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

export const MONITOR_NAME_MAX = 20;

// ---- 画面の時計 (日本時間) -------------------------------------------------------------

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const EN_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** 日本時間の日付・時刻の表示と、0時からの秒。画面の中で毎秒進める (データは取りに行かない)。 */
export function jstClock(at: Date): {
  dateText: string;
  timeText: string;
  secondsOfDay: number;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const second = Number(get("second"));
  const weekday = WEEKDAYS[EN_WEEKDAYS.indexOf(get("weekday"))] ?? "";
  return {
    dateText: `${get("month")}/${get("day")}(${weekday})`,
    timeText: `${hour}:${String(minute).padStart(2, "0")}`,
    secondsOfDay: hour * 3600 + minute * 60 + second,
  };
}
