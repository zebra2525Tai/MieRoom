import Form from "next/form";
import Link from "next/link";
import {
  MyClassSelect,
  type ClassOption,
} from "@/components/shell/my-class-select";
import { AutoSubmitInput, AutoSubmitSelect } from "@/components/ui/auto-submit";
import { LinkButton } from "@/components/ui/button";
import { filterFieldClass, filterSelectClass } from "@/components/ui/form";
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
  // The page caps the lesson list at max-w-4xl (see TimetableView): on wide screens
  // the room stays close to its lesson.
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
              running ? "border-[#5d6ee1] bg-[#f2f5ff]" : ""
            }`}
          >
            <div className="text-xs font-bold text-[#4a576c]">
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

// Below lg (phones, and tablets where the sidebar leaves about 512px) the week is a list
// of days, each with compact lesson rows. From lg it is a table; the table is also what
// is printed.
function WeekView({ days, today }: { days: TimetableDay[]; today: string }) {
  return (
    <>
      <WeekList days={days} today={today} />
      {/* table-fixed with a fixed 時限 column keeps the five days equally wide; below
          680px it scrolls sideways with 時限 kept in view. Dense cells (px-2.5) leave
          room for a 9-character subject on one line at 1024. */}
      <TableWrap
        className="hidden lg:block print:block"
        tableClassName="table-fixed min-w-[680px]"
      >
        <colgroup>
          <col className="w-[80px]" />
          {days.map((day) => (
            <col key={day.date} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <Th stickyLeft dense>
              時限
            </Th>
            {days.map((day) => (
              <Th key={day.date} dense highlight={day.date === today}>
                {formatDate(day.date, today)}
                {day.closures.map((name) => (
                  <span
                    key={name}
                    className="mt-0.5 block whitespace-normal font-normal text-amber-ink"
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
              <Td
                stickyLeft
                dense
                className="align-top font-bold text-[#4a576c]"
              >
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
                  <Td
                    key={day.date}
                    dense
                    className={`whitespace-normal align-top ${
                      day.date === today ? "bg-[#f2f5ff]" : ""
                    }`}
                  >
                    {!day.entered ? (
                      <span className="text-muted">未定</span>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {lessons.map((lesson) => (
                          <div key={lesson.id}>
                            <div
                              className={`font-bold ${lesson.cancelled ? "text-muted line-through" : ""}`}
                            >
                              {lesson.subject}
                            </div>
                            <div className="mt-0.5 text-[11px]">
                              <span
                                className={`font-semibold ${
                                  lesson.cancelled
                                    ? "text-muted line-through"
                                    : "text-navy"
                                }`}
                              >
                                {roomText(lesson.room)}
                              </span>{" "}
                              <span className="text-muted">
                                / {teacherText(lesson.teachers)}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1 empty:hidden">
                              <LessonBadges lesson={lesson} wrap />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  );
}

/** The week on phones: a section per day with compact lesson rows. */
function WeekList({ days, today }: { days: TimetableDay[]; today: string }) {
  return (
    <div className="flex flex-col gap-5 lg:hidden print:hidden">
      {days.map((day) => {
        const isToday = day.date === today;
        return (
          <section key={day.date}>
            <h2 className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold">
              <span className={isToday ? "text-brand-dark" : ""}>
                {formatDate(day.date, today)}
              </span>
              {isToday && <Badge kind="busy">今日</Badge>}
              {day.closures.map((name) => (
                <Badge key={name} kind="warning" wrap>
                  {name}
                </Badge>
              ))}
            </h2>
            <Card className="overflow-hidden">
              {!day.entered ? (
                <p className="px-4 py-3 text-xs text-muted">未定</p>
              ) : (
                <ul className="divide-y divide-line">
                  {PERIODS.map((period) => {
                    const lessons = day.lessons.filter(
                      (lesson) => lesson.periodNo === period.no,
                    );
                    return (
                      <li
                        key={period.no}
                        className="grid grid-cols-[60px_minmax(0,1fr)] gap-3 px-4 py-3"
                      >
                        <div className="text-xs font-bold text-[#4a576c]">
                          {period.label}
                          <span className="mt-0.5 block text-[11px] font-normal text-muted">
                            {period.start}-{period.end}
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-col gap-2.5">
                          {lessons.length === 0 ? (
                            <span className="text-xs text-muted">授業なし</span>
                          ) : (
                            lessons.map((lesson) => (
                              <CompactLesson key={lesson.id} lesson={lesson} />
                            ))
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </section>
        );
      })}
    </div>
  );
}

function CompactLesson({ lesson }: { lesson: LessonView }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`text-[13px] font-bold ${
              lesson.cancelled ? "text-muted line-through" : ""
            }`}
          >
            {lesson.subject}
          </span>
          <LessonBadges lesson={lesson} wrap />
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-muted">
          {lesson.className && <span>{lesson.className}</span>}
          <span>{teacherText(lesson.teachers)}</span>
        </div>
      </div>
      <span
        className={`shrink-0 text-base font-bold ${
          lesson.cancelled ? "text-muted line-through" : "text-navy"
        }`}
      >
        {roomText(lesson.room)}
      </span>
    </div>
  );
}

// Below lg (phones, and tablets where the sidebar leaves about 512px) the month is a
// compact calendar whose days open the day view. From lg it is the full grid; the grid
// is also what is printed.
function MonthView({
  days,
  month,
  today,
  dayHref,
}: {
  days: TimetableDay[];
  month: string;
  today: string;
  dayHref: (date: string) => string;
}) {
  const lastRowFrom = days.length - 7;
  return (
    <>
      <MonthCalendar
        days={days}
        month={month}
        today={today}
        dayHref={dayHref}
      />
      {/* From xl only: at lg the weekday columns are too narrow to read a subject,
          so the compact calendar is used up to xl. 土/日 are narrower (usually no
          lessons). Below 680px the grid scrolls sideways. The last column and row drop their outer border, which the box
          already draws. */}
      <div className="scroll-shadow-x hidden overflow-auto rounded-[11px] border border-line xl:block print:block">
        <div className="grid min-w-[680px] grid-cols-[repeat(5,minmax(0,1fr))_minmax(0,0.6fr)_minmax(0,0.6fr)] [&>*:nth-child(7n)]:border-r-0">
          {WEEKDAY_HEADERS.map((name) => (
            <div
              key={name}
              className="border-b border-line bg-[#f6f8fc] px-3 py-2 text-[11px] font-semibold text-[#586579]"
            >
              {name}
            </div>
          ))}
          {days.map((day, index) => {
            const outside = monthOf(day.date) !== month;
            const weekend = weekdayOf(day.date) % 6 === 0;
            const isToday = day.date === today;
            return (
              <div
                key={day.date}
                className={`min-h-[104px] min-w-0 border-r border-line p-2 text-[11px] ${
                  index >= lastRowFrom ? "" : "border-b"
                } ${
                  isToday
                    ? "bg-[#f2f5ff]"
                    : outside
                      ? "bg-[#f6f8fc] text-muted"
                      : ""
                }`}
              >
                {/* The day number opens the day view, where cut subjects show in full. */}
                <div>
                  <Link
                    href={dayHref(day.date)}
                    className={`-my-1 inline-flex min-h-6 min-w-6 items-center hover:underline ${isToday ? "font-bold text-brand-dark" : outside ? "font-normal" : "font-bold"}`}
                  >
                    <span className="sr-only">{formatLongDate(day.date)}</span>
                    <span aria-hidden="true">
                      {Number(day.date.slice(8, 10))}
                    </span>
                    {isToday && (
                      <span className="ml-1.5 font-normal">今日</span>
                    )}
                  </Link>
                </div>
                {day.closures.map((name) => (
                  <div key={name} className="mt-0.5 text-amber-ink">
                    {name}
                  </div>
                ))}
                {!outside && !weekend && !day.entered && (
                  <div className="mt-0.5 text-muted">未定</div>
                )}
                {/* The room never truncates: only the subject does. */}
                {day.lessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className={`mt-0.5 flex gap-1 ${lesson.cancelled ? "text-muted line-through" : ""}`}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {periodLabel(lesson.periodNo)} {lesson.subject}
                    </span>
                    <span className="shrink-0 text-muted">
                      {roomText(lesson.room)}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/** The month below xl: 7 narrow columns, each day a link to its day view. */
function MonthCalendar({
  days,
  month,
  today,
  dayHref,
}: {
  days: TimetableDay[];
  month: string;
  today: string;
  dayHref: (date: string) => string;
}) {
  const lastRowFrom = days.length - 7;
  return (
    <div className="xl:hidden print:hidden">
      <div className="overflow-hidden rounded-[11px] border border-line bg-white">
        <div className="grid grid-cols-7 [&>*:nth-child(7n)]:border-r-0">
          {WEEKDAY_HEADERS.map((name) => (
            <div
              key={name}
              className="border-b border-line bg-[#f6f8fc] py-2 text-center text-[11px] font-semibold text-[#586579]"
            >
              {name}
            </div>
          ))}
          {days.map((day, index) => {
            const outside = monthOf(day.date) !== month;
            const weekend = weekdayOf(day.date) % 6 === 0;
            const isToday = day.date === today;
            const count = day.lessons.filter(
              (lesson) => !lesson.cancelled,
            ).length;
            const cancelled = day.lessons.some((lesson) => lesson.cancelled);
            return (
              <Link
                key={day.date}
                href={dayHref(day.date)}
                className={`flex min-h-[64px] min-w-0 flex-col items-center gap-1 border-r border-line px-0.5 pb-1.5 pt-1 text-center focus-visible:-outline-offset-3 ${
                  index >= lastRowFrom ? "" : "border-b"
                } ${
                  isToday
                    ? "bg-[#f2f5ff]"
                    : outside
                      ? "bg-[#f6f8fc] text-muted"
                      : ""
                }`}
              >
                <span className="sr-only">
                  {formatLongDate(day.date)}
                  {isToday && " 今日"}
                </span>
                <span
                  aria-hidden="true"
                  className={`inline-flex size-6 items-center justify-center rounded-full text-xs ${
                    isToday
                      ? "bg-brand font-bold text-white"
                      : outside
                        ? "font-normal"
                        : "font-bold"
                  }`}
                >
                  {Number(day.date.slice(8, 10))}
                </span>
                {count > 0 && (
                  <span
                    className={`text-[11px] leading-none ${outside ? "" : "text-[#4a576c]"}`}
                  >
                    {count}コマ
                  </span>
                )}
                {!outside && !weekend && !day.entered && (
                  <span className="text-[11px] leading-none text-muted">
                    未定
                  </span>
                )}
                {(cancelled || day.closures.length > 0) && (
                  <span className="flex items-center gap-1">
                    {day.closures.length > 0 && (
                      <>
                        <span
                          aria-hidden="true"
                          className="size-2 rotate-45 bg-[#b86e00]"
                        />
                        <span className="sr-only">
                          {day.closures.join("、")}
                        </span>
                      </>
                    )}
                    {cancelled && (
                      <>
                        <span
                          aria-hidden="true"
                          className="size-2 rounded-full bg-red-ink"
                        />
                        <span className="sr-only">休講あり</span>
                      </>
                    )}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rotate-45 bg-[#b86e00]" />
          休み・行事
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-red-ink" />
          休講あり
        </span>
      </p>
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
      {/* Phones: three aligned full-width rows (表示 / 前へ・今日・次へ / 日付・講師).
          From sm everything sits inline and wraps. */}
      <FilterBar className="print:hidden">
        <Segmented
          stretch
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
        <div className="grid w-full grid-cols-3 gap-1.5 sm:flex sm:w-auto sm:items-center">
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
        <Form
          action={basePath}
          className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-2.5"
        >
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
            className={`${filterFieldClass} w-full min-w-0 sm:w-auto`}
          />
          <AutoSubmitSelect
            key={selectedTeacherId ?? "none"}
            className={`${filterSelectClass} w-full min-w-0 sm:w-auto`}
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

      {/* Only the lesson list is capped (max-w-4xl), so on wide screens the room
            stays close to its lesson. The banner and callouts span the full width, like
            the filter bar above and the week and month views. */}
      {mode === "day" && days[0] && (
        <div className="max-w-4xl">
          <DayView
            day={days[0]}
            today={today}
            minutes={minutes}
            canChange={canChange}
            changeBasePath={changeBasePath}
            addHref={addHref}
          />
        </div>
      )}
      {mode === "week" && <WeekView days={days} today={today} />}
      {mode === "month" && (
        <MonthView
          days={days}
          month={monthOf(date)}
          today={today}
          dayHref={(day) => hrefFor({ view: "day", date: day })}
        />
      )}
    </>
  );
}
