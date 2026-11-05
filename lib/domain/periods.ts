// 時限と枠 (外部設計書 R3-1). The same for every class, fixed by the school.

export type PeriodNo = 1 | 2 | 3 | 4;
export type SlotNo = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type Period = {
  no: PeriodNo;
  label: string;
  start: string;
  middle: string;
  end: string;
};

export type Slot = {
  no: SlotNo;
  periodNo: PeriodNo;
  half: "前半" | "後半";
  label: string;
  start: string;
  end: string;
};

export const PERIODS: readonly Period[] = [
  { no: 1, label: "1限", start: "9:15", middle: "10:00", end: "10:45" },
  { no: 2, label: "2限", start: "11:00", middle: "11:45", end: "12:30" },
  { no: 3, label: "3限", start: "13:30", middle: "14:15", end: "15:00" },
  { no: 4, label: "4限", start: "15:15", middle: "16:00", end: "16:45" },
];

export const SLOTS: readonly Slot[] = PERIODS.flatMap((period) => [
  {
    no: ((period.no - 1) * 2 + 1) as SlotNo,
    periodNo: period.no,
    half: "前半" as const,
    label: `${period.label}前半`,
    start: period.start,
    end: period.middle,
  },
  {
    no: ((period.no - 1) * 2 + 2) as SlotNo,
    periodNo: period.no,
    half: "後半" as const,
    label: `${period.label}後半`,
    start: period.middle,
    end: period.end,
  },
]);

export function toMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

/** The two slots of a period: 前半 and 後半. */
export function slotsOfPeriod(periodNo: PeriodNo): [Slot, Slot] {
  return [SLOTS[(periodNo - 1) * 2], SLOTS[(periodNo - 1) * 2 + 1]];
}

/** The period running at this minute, if any. */
export function periodAt(minutes: number): Period | null {
  return (
    PERIODS.find(
      (period) =>
        minutes >= toMinutes(period.start) && minutes < toMinutes(period.end),
    ) ?? null
  );
}

/**
 * The period S04 opens with: the one running now, else the next one, and
 * 1限 once today's 4限 is over.
 */
export function defaultPeriodNo(minutes: number): PeriodNo {
  const period = PERIODS.find((item) => minutes < toMinutes(item.end));
  return period?.no ?? 1;
}

export function parsePeriodNo(value: unknown): PeriodNo | null {
  const number = Number(value);
  return number === 1 || number === 2 || number === 3 || number === 4
    ? number
    : null;
}
