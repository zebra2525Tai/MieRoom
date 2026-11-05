import Form from "next/form";
import {
  MyClassSelect,
  type ClassOption,
} from "@/components/shell/my-class-select";
import { AutoSubmitInput, AutoSubmitSelect } from "@/components/ui/auto-submit";
import { LinkButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Badge,
  Callout,
  Card,
  EmptyState,
  FilterBar,
  PageHeading,
  Segmented,
  TableWrap,
  Td,
  Th,
} from "@/components/ui/parts";
import { PERIODS } from "@/lib/domain/periods";
import {
  addDays,
  addMonths,
  formatDate,
  formatLongDate,
  formatMonth,
  monthOf,
  weekdayOf,
} from "@/lib/domain/school-date";
import { withQuery } from "@/lib/url";
import {
  isRunning,
  LessonBadges,
  periodLabel,
  roomText,
  teacherText,
  type LessonView,
  type TimetableDay,
} from "./lesson-parts";

export type TimetableMode = "day" | "week" | "month";

const WEEKDAY_HEADERS = ["月", "火", "水", "木", "金", "土", "日"];

function DayView({
  day,
  today,
  minutes,
  canChange,
  changeBasePath,
  addHref,
}: {
  day: TimetableDay;
  today: string;
  minutes: number;
  canChange: boolean;
  changeBasePath: string;
  addHref: string | null;
}) {
  if (!day.entered) {
    return (
      <EmptyState title="この日の時間割は未定です">
        担任の時間割が取り込まれると、ここに出ます。「授業なし」という意味ではありません。
      </EmptyState>
    );
  }
  const changeable = canChange && day.date >= today;
  return (
    <div className="flex flex-col gap-2.5">
      {PERIODS.map((period) => {
        const lessons = day.lessons.filter(
          (lesson) => lesson.periodNo === period.no,
        );
        const running = isRunning(period.no, day.date, today, minutes);
        return (
          <Card
            key={period.no}
            className={`grid grid-cols-[60px_minmax(0,1fr)_64px] items-center gap-3 px-3 py-4 sm:grid-cols-[96px_minmax(0,1fr)_140px] sm:gap-4 sm:px-6 sm:py-5 ${
              running ? "border-[#9bcabb] bg-[#f4fbf7]" : ""
            }`}
          >
            <div className="text-xs font-bold text-[#4f6c7a]">
              {period.label}
              <small className="mt-0.5 block text-[11px] font-normal text-muted">
                {period.start}-{period.end}
              </small>
            </div>
            <div className="min-w-0">
              {lessons.length === 0 ? (
                <span className="text-xs text-muted">授業なし</span>
              ) : (
                lessons.map((lesson) => (
                  <LessonLine
                    key={lesson.id}
                    lesson={lesson}
                    running={running}
                    changeable={changeable}
                    changeBasePath={changeBasePath}
                  />
                ))
              )}
            </div>
            <div className="text-right">
              {lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className={`text-[19px] font-bold text-navy sm:text-[22px] ${
                    lesson.cancelled ? "text-muted line-through" : ""
                  }`}
                >
                  {roomText(lesson.room)}
                </div>
              ))}
            </div>
          </Card>
        );
      })}
      {changeable && addHref && (
        <div className="print:hidden">
          <LinkButton href={addHref}>
            <Icon name="plus" size={15} />
            授業を足す(補講)
          </LinkButton>
        </div>
      )}
    </div>
  );
}

function LessonLine({
  lesson,
  running,
  changeable,
  changeBasePath,
}: {
  lesson: LessonView;
  running: boolean;
  changeable: boolean;
  changeBasePath: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`text-[13px] font-bold sm:text-base ${
            lesson.cancelled ? "text-muted line-through" : ""
          }`}
        >
          {lesson.subject}
        </span>
        {running && !lesson.cancelled && <Badge kind="busy">いま</Badge>}
        <LessonBadges lesson={lesson} />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        {lesson.className && <span>{lesson.className}</span>}
        <span>{teacherText(lesson.teachers)}</span>
        {changeable && (
          <LinkButton
            size="sm"
            href={`${changeBasePath}/${lesson.id}`}
            className="print:hidden"
          >
            <Icon name="edit" size={13} />
            変更
          </LinkButton>
        )}
      </div>
    </div>
  );
}

function WeekView({ days, today }: { days: TimetableDay[]; today: string }) {
  return (
    <TableWrap>
      <thead>
        <tr>
          <Th>時限</Th>
          {days.map((day) => (
            <Th key={day.date} highlight={day.date === today}>
              {formatDate(day.date, today)}
              {day.closures.map((name) => (
                <span
                  key={name}
                  className="mt-0.5 block font-normal text-amber-ink"
                >
                  {name}
                </span>
              ))}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {PERIODS.map((period) => (
          <tr key={period.no}>
            <Td className="font-bold text-[#4f6c7a]">
              {period.label}
              <span className="mt-0.5 block text-[11px] font-normal text-muted">
                {period.start}-{period.end}
              </span>
            </Td>
            {days.map((day) => {
              const lessons = day.lessons.filter(
                (lesson) => lesson.periodNo === period.no,
              );
              return (
                <Td key={day.date} className="min-w-[130px] align-top">
                  {!day.entered ? (
                    <span className="text-muted">未定</span>
                  ) : (
                    lessons.map((lesson) => (
                      <div key={lesson.id}>
                        <div
                          className={`font-bold ${lesson.cancelled ? "text-muted line-through" : ""}`}
                        >
                          {lesson.subject}
                        </div>
                        <div className="text-[11px] text-muted">
                          {roomText(lesson.room)} /{" "}
                          {teacherText(lesson.teachers)}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <LessonBadges lesson={lesson} />
                        </div>
                      </div>
                    ))
                  )}
                </Td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}

function MonthView({
  days,
  month,
  today,
}: {
  days: TimetableDay[];
  month: string;
  today: string;
}) {
  return (
    <div className="overflow-auto rounded-[11px] border border-line bg-white">
      <div className="grid min-w-[840px] grid-cols-7">
        {WEEKDAY_HEADERS.map((name) => (
          <div
            key={name}
            className="border-b border-line bg-[#f6f9fb] px-3 py-2 text-[11px] font-semibold text-[#6c8291]"
          >
            {name}
          </div>
        ))}
        {days.map((day) => {
          const outside = monthOf(day.date) !== month;
          const weekend = weekdayOf(day.date) % 6 === 0;
          return (
            <div
              key={day.date}
              className={`min-h-[104px] border-b border-r border-[#edf1f4] p-2 text-[11px] ${
                outside ? "bg-[#fafbfc] text-[#a6b3bc]" : ""
              }`}
            >
              <div
                className={`font-bold ${day.date === today ? "text-teal-dark" : ""}`}
              >
                {Number(day.date.slice(8, 10))}
                {day.date === today && (
                  <span className="ml-1.5 font-normal">今日</span>
                )}
              </div>
              {day.closures.map((name) => (
                <div key={name} className="mt-0.5 text-amber-ink">
                  {name}
                </div>
              ))}
              {!outside && !weekend && !day.entered && (
                <div className="mt-0.5 text-muted">未定</div>
              )}
              {day.lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className={`mt-0.5 truncate ${lesson.cancelled ? "text-muted line-through" : ""}`}
                >
                  {periodLabel(lesson.periodNo)} {lesson.subject}{" "}
                  <span className="text-muted">{roomText(lesson.room)}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// S03 時間割
export function TimetableView({
  mode,
  date,
  today,
  minutes,
  days,
  classes,
  selectedClassId,
  todayFiscalYear,
  teachers,
  selectedTeacherId,
  canChange,
  basePath = "/timetable",
  changeBasePath = "/teacher/lessons",
  addHref = null,
}: {
  mode: TimetableMode;
  date: string;
  today: string;
  minutes: number;
  days: TimetableDay[];
  classes: ClassOption[];
  selectedClassId: string | null;
  todayFiscalYear: number;
  teachers: { id: string; name: string }[];
  selectedTeacherId: string | null;
  canChange: boolean;
  basePath?: string;
  /** Where S14 lives: `${changeBasePath}/${lesson id}`. */
  changeBasePath?: string;
  /** Where 「授業を足す」 goes. Left out until the screen exists. */
  addHref?: string | null;
}) {
  const scope = {
    class: selectedClassId,
    teacher: selectedTeacherId,
  };
  const hrefFor = (next: { view?: TimetableMode; date?: string }) =>
    withQuery(basePath, {
      ...scope,
      view: next.view ?? mode,
      date: next.date ?? date,
    });
  const previous =
    mode === "day"
      ? addDays(date, -1)
      : mode === "week"
        ? addDays(date, -7)
        : `${addMonths(monthOf(date), -1)}-01`;
  const following =
    mode === "day"
      ? addDays(date, 1)
      : mode === "week"
        ? addDays(date, 7)
        : `${addMonths(monthOf(date), 1)}-01`;
  const subject = selectedTeacherId
    ? teachers.find((item) => item.id === selectedTeacherId)?.name
    : classes.find((item) => item.id === selectedClassId)?.name;
  const allClosures = mode === "day" ? (days[0]?.closures ?? []) : [];

  return (
    <>
      <PageHeading
        title="時間割"
        description="今日・今週・月で、クラスの授業を確認できます。講師で絞ることもできます。"
        actions={
          <MyClassSelect
            classes={classes}
            selectedId={selectedTeacherId ? null : selectedClassId}
            todayFiscalYear={todayFiscalYear}
            emptyLabel={selectedTeacherId ? "(講師で表示中)" : undefined}
          />
        }
      />
      <FilterBar className="print:hidden">
        <Segmented
          label="表示"
          items={(
            [
              ["day", "今日"],
              ["week", "今週"],
              ["month", "月"],
            ] as const
          ).map(([view, label]) => ({
            label,
            href: hrefFor({ view }),
            active: mode === view,
          }))}
        />
        <div className="flex items-center gap-1.5">
          <LinkButton size="sm" href={hrefFor({ date: previous })}>
            <Icon name="chevronLeft" size={13} />
            前へ
          </LinkButton>
          <LinkButton size="sm" href={hrefFor({ date: today })}>
            今日
          </LinkButton>
          <LinkButton size="sm" href={hrefFor({ date: following })}>
            次へ
            <Icon name="chevron" size={13} />
          </LinkButton>
        </div>
        <Form action={basePath} className="flex flex-wrap items-center gap-2.5">
          <input type="hidden" name="view" value={mode} />
          {selectedClassId && !selectedTeacherId && (
            <input type="hidden" name="class" value={selectedClassId} />
          )}
          <AutoSubmitInput
            key={date}
            type="date"
            name="date"
            defaultValue={date}
            aria-label="基準の日"
          />
          <AutoSubmitSelect
            key={selectedTeacherId ?? "none"}
            name="teacher"
            defaultValue={selectedTeacherId ?? ""}
            aria-label="講師で絞る"
          >
            <option value="">講師で絞らない</option>
            {teachers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </AutoSubmitSelect>
          <noscript>
            <button type="submit">表示</button>
          </noscript>
        </Form>
      </FilterBar>

      <Callout icon="calendar">
        <strong className="font-semibold">{subject ?? "クラス未選択"}</strong>
        <br />
        {mode === "month"
          ? formatMonth(monthOf(date))
          : mode === "week"
            ? `${formatLongDate(days[0]?.date ?? date)} の週`
            : formatLongDate(date)}
        の時間割
      </Callout>

      {allClosures.length > 0 && (
        <Callout kind="warning" icon="calendar">
          {allClosures.join("、")}
        </Callout>
      )}

      {mode === "day" && days[0] && (
        <DayView
          day={days[0]}
          today={today}
          minutes={minutes}
          canChange={canChange}
          changeBasePath={changeBasePath}
          addHref={addHref}
        />
      )}
      {mode === "week" && <WeekView days={days} today={today} />}
      {mode === "month" && (
        <MonthView days={days} month={monthOf(date)} today={today} />
      )}
    </>
  );
}
