import {
  TimetableView,
  type TimetableMode,
} from "@/components/screens/timetable-view";
import {
  addDays,
  fiscalYearOfDate,
  isSchoolDate,
  mondayOf,
  monthOf,
  monthWeeks,
  schoolMinutes,
  schoolToday,
  weekdayOf,
} from "@/lib/domain/school-date";
import {
  listActiveTeachers,
  listClassesForYear,
} from "@/lib/server/queries/common";
import { loadTimetableDays } from "@/lib/server/queries/lessons";
import { hasRole, requireUser } from "@/lib/server/session";
import { one } from "@/lib/url";

function datesOf(mode: TimetableMode, date: string): string[] {
  if (mode === "day") return [date];
  if (mode === "week") {
    // 月〜土。土曜は、授業があるときだけ出す(下で、授業のない土曜を外す。14-1 #19)。
    const monday = mondayOf(date);
    return [0, 1, 2, 3, 4, 5].map((offset) => addDays(monday, offset));
  }
  return monthWeeks(monthOf(date)).flat();
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
  const loaded = await loadTimetableDays(datesOf(mode, date), {
    classId: selectedClass?.id ?? null,
    teacherId: selectedTeacher?.id ?? null,
  });
  const days =
    mode === "week"
      ? loaded.filter(
          (day) => weekdayOf(day.date) !== 6 || day.lessons.length > 0,
        )
      : loaded;

  return (
    <TimetableView
      mode={mode}
      date={date}
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
