import {
  TimetableView,
  type TimetableMode,
} from "@/components/screens/timetable-view";
import {
  fiscalYearOfDate,
  isSchoolDate,
  monthOf,
  monthWeeks,
  parseWeekStart,
  schoolMinutes,
  schoolToday,
  weekDates,
  weekdayOf,
  type WeekStart,
} from "@/lib/domain/school-date";
import {
  listActiveTeachers,
  listClassesForYear,
} from "@/lib/server/queries/common";
import { loadTimetableDays } from "@/lib/server/queries/lessons";
import { hasRole, requireUser } from "@/lib/server/session";
import { one } from "@/lib/url";

function datesOf(
  mode: TimetableMode,
  date: string,
  start: WeekStart,
): string[] {
  if (mode === "day") return [date];
  // 月〜土 (月曜始まり) または 日〜土 (日曜始まり)。土日は、授業があるときだけ出す
  // (下で、授業のない土日を外す。14-1 #19)。
  if (mode === "week") return weekDates(date, start);
  return monthWeeks(monthOf(date), start).flat();
}

// S03 時間割
export default async function TimetablePage({
  searchParams,
}: PageProps<"/timetable">) {
  const user = await requireUser();
  const params = await searchParams;
  const now = new Date();
  const today = schoolToday(now);
  const requestedDate = one(params.date);
  const date = isSchoolDate(requestedDate) ? requestedDate : today;
  const view = one(params.view);
  const mode: TimetableMode =
    view === "week" || view === "month" ? view : "day";
  // 週の始まり。選んだ方はブラウザが覚えて、URL で送ってくる (week-start-memory.tsx)。
  const weekStart = parseWeekStart(one(params.start));

  const [classes, teachers] = await Promise.all([
    listClassesForYear(fiscalYearOfDate(date)),
    listActiveTeachers(),
  ]);
  const selectedTeacher =
    teachers.find((item) => item.id === one(params.teacher)) ?? null;
  const selectedClass = selectedTeacher
    ? null
    : (classes.find((item) => item.id === one(params.class)) ??
      classes[0] ??
      null);
  const loaded = await loadTimetableDays(datesOf(mode, date, weekStart), {
    classId: selectedClass?.id ?? null,
    teacherId: selectedTeacher?.id ?? null,
  });
  const days =
    mode === "week"
      ? loaded.filter(
          (day) => weekdayOf(day.date) % 6 !== 0 || day.lessons.length > 0,
        )
      : loaded;

  return (
    <TimetableView
      mode={mode}
      date={date}
      weekStart={weekStart}
      today={today}
      minutes={schoolMinutes(now)}
      days={days}
      classes={classes}
      selectedClassId={selectedClass?.id ?? null}
      todayFiscalYear={fiscalYearOfDate(today)}
      teachers={teachers}
      selectedTeacherId={selectedTeacher?.id ?? null}
      canChange={hasRole(user, "teacher")}
    />
  );
}
