import { Badge } from "@/components/ui/parts";
import { periodAt, PERIODS, type PeriodNo } from "@/lib/domain/periods";

// 授業の見せ方 (外部設計書 6-1, R3-11). Shared by S02, S03 and S14.

export type LessonView = {
  id: string;
  date: string;
  periodNo: PeriodNo;
  subject: string;
  /** Empty: 各担当 */
  teachers: string[];
  /** null: 教室未定 (shown as 各教室) */
  room: string | null;
  /** Set when the screen lists several classes (S03 by teacher). */
  className?: string;
  cancelled: boolean;
  /** 補講: added in the system, not imported. */
  extra: boolean;
  /** Set when the room was changed in the system: the room before. */
  previousRoom: string | null;
  /** Set when the teachers were changed in the system: the teachers before. */
  previousTeachers: string[] | null;
};

export type TimetableDay = {
  date: string;
  /** 入力済み (R3-7). False: the whole day is 未定. */
  entered: boolean;
  closures: string[];
  lessons: LessonView[];
};

export function roomText(room: string | null): string {
  return room ?? "各教室";
}

export function teacherText(teachers: string[]): string {
  return teachers.length === 0 ? "各担当" : teachers.join("、");
}

export function periodLabel(periodNo: PeriodNo): string {
  return PERIODS[periodNo - 1].label;
}

export function periodTime(periodNo: PeriodNo): string {
  const period = PERIODS[periodNo - 1];
  return `${period.start}-${period.end}`;
}

/** Whether this period of today is running at this minute. */
export function isRunning(
  periodNo: PeriodNo,
  date: string,
  today: string,
  minutes: number,
): boolean {
  return date === today && periodAt(minutes)?.no === periodNo;
}

/** The marks of a lesson changed in the system. Shown to everyone (R3-11). */
export function LessonBadges({ lesson }: { lesson: LessonView }) {
  return (
    <>
      {lesson.cancelled && <Badge kind="error">休講</Badge>}
      {lesson.extra && <Badge kind="busy">補講</Badge>}
      {lesson.previousRoom !== null && (
        <Badge kind="warning">
          教室変更({roomText(lesson.previousRoom)}から変更)
        </Badge>
      )}
      {lesson.previousTeachers !== null && <Badge kind="warning">代理</Badge>}
    </>
  );
}
