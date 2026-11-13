import Form from "next/form";
import {
  MyClassSelect,
  type ClassOption,
} from "@/components/shell/my-class-select";
import { LinkButton } from "@/components/ui/button";
import { SearchField } from "@/components/ui/form";
import { Icon, type IconName } from "@/components/ui/icon";
import { Badge, Callout, Card } from "@/components/ui/parts";
import { formatDate } from "@/lib/domain/school-date";
import { MESSAGES } from "@/lib/messages";
import { withQuery } from "@/lib/url";
import {
  LessonBadges,
  periodLabel,
  periodTime,
  roomText,
  teacherText,
  type LessonView,
} from "./lesson-parts";

/** undecided: 未定 (R3-7, R6-4). ready: found in what has been entered. */
export type HomeLessons =
  | { kind: "undecided" }
  | { kind: "ready"; current: LessonView | null; next: LessonView | null };

/** The large card: the lesson running now, with its room shown big. */
function CurrentLessonCard({
  className = "",
  selected,
  lessons,
  timetableHref,
}: {
  /** Grid placement only. */
  className?: string;
  selected: boolean;
  lessons: HomeLessons;
  timetableHref: string;
}) {
  const current = lessons.kind === "ready" ? lessons.current : null;
  // Card's look with its own tint and border (not Card + className: overriding
  // Card's bg-white and border color would depend on the CSS order).
  return (
    <div
      className={`rounded-card border border-[#cfd7ff] bg-[#f2f5ff] p-6 shadow-card ${className}`}
    >
      <CardLabel icon="calendar">いまの授業</CardLabel>
      {!selected ? (
        <h2 className="mb-6 mt-5 text-[19px] font-bold">
          クラスを選ぶと、いまの授業が出ます
        </h2>
      ) : lessons.kind === "undecided" ? (
        <div className="mb-5 mt-3 text-[44px] font-bold leading-tight text-navy sm:text-[52px]">
          未定
        </div>
      ) : current ? (
        <div className="mt-3">
          <div className="text-[44px] font-bold leading-tight tracking-tight text-navy sm:text-[52px]">
            {roomText(current.room)}
            {current.room && (
              <span className="ml-2 text-[19px] font-semibold tracking-normal">
                教室
              </span>
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="text-base font-bold">{current.subject}</span>
            <LessonBadges lesson={current} />
          </div>
          <div className="mb-5 mt-1.5 flex flex-wrap gap-4 text-xs text-[#586579]">
            <span>
              {periodLabel(current.periodNo)} {periodTime(current.periodNo)}
            </span>
            <span>{teacherText(current.teachers)}</span>
          </div>
        </div>
      ) : (
        <h2 className="mb-6 mt-5 text-[19px] font-bold">{MESSAGES.MI003}</h2>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <LinkButton variant="primary" href={timetableHref}>
          今日の時間割を見る
          <Icon name="arrow" size={15} />
        </LinkButton>
        <LinkButton href="/rooms">空き教室を見る</LinkButton>
      </div>
    </div>
  );
}

/** The small blue label at the top of the two upper cards. */
function CardLabel({ icon, children }: { icon: IconName; children: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.12em] text-brand">
      <Icon name={icon} size={15} />
      {children}
    </div>
  );
}

// S02 ホーム
export function HomeView({
  today,
  classes,
  selectedClassId,
  todayFiscalYear,
  yearChanged,
  lessons,
  closures,
}: {
  today: string;
  classes: ClassOption[];
  selectedClassId: string | null;
  todayFiscalYear: number;
  yearChanged: boolean;
  lessons: HomeLessons;
  closures: string[];
}) {
  const next = lessons.kind === "ready" ? lessons.next : null;
  return (
    <>
      <h1 className="sr-only">ホーム</h1>
      {/* Phones: the class picker and 予約する each take a full row. From sm: one row, right-aligned. */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <MyClassSelect
          classes={classes}
          selectedId={selectedClassId}
          todayFiscalYear={todayFiscalYear}
          emptyLabel="選んでください"
        />
        <LinkButton
          variant="primary"
          href="/reservations/new"
          className="w-full sm:w-auto"
        >
          <Icon name="plus" size={16} />
          予約する
        </LinkButton>
      </div>
      {yearChanged ? (
        <Callout kind="warning">{MESSAGES.MI002}</Callout>
      ) : (
        !selectedClassId && <Callout>{MESSAGES.MI001}</Callout>
      )}

      {/* One grid so that, below lg, the two lessons come one after the other
          (いま, 次, 先生の位置, 休み・行事 — also the reading order). From lg the cards
          are placed in two rows: いま | 先生の位置, then 次 | 休み・行事. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <CurrentLessonCard
          className="lg:col-start-1 lg:row-start-1"
          selected={selectedClassId !== null}
          lessons={lessons}
          timetableHref={withQuery("/timetable", {
            class: selectedClassId,
            date: today,
          })}
        />
        <Card className="p-6 lg:col-start-1 lg:row-start-2">
          <h2 className="text-[17px] font-bold">次の授業</h2>
          {!selectedClassId ? (
            <p className="mt-2 text-xs text-muted">{MESSAGES.MI001}</p>
          ) : lessons.kind === "undecided" ? (
            <p className="mt-2 text-xs text-muted">未定</p>
          ) : next ? (
            <div className="mt-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{next.subject}</span>
                <LessonBadges lesson={next} />
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                {next.date !== today && (
                  <span>{formatDate(next.date, today)}</span>
                )}
                <span>
                  {periodLabel(next.periodNo)} {periodTime(next.periodNo)}
                </span>
                <span>{roomText(next.room)}</span>
                <span>{teacherText(next.teachers)}</span>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted">
              入力済みの時間割の範囲で、次の授業が見つかりません。
            </p>
          )}
        </Card>
        <Card className="flex flex-col p-6 lg:col-start-2 lg:row-start-1">
          <CardLabel icon="pin">先生の位置</CardLabel>
          <h2 className="mt-2 text-[17px] font-bold">先生は、どこにいる?</h2>
          <p className="mb-4 mt-1.5 text-xs text-muted">
            質問・相談の前に、居場所を確認できます。
          </p>
          <Form action="/teachers">
            <SearchField
              name="q"
              aria-label="探したい先生の名前"
              placeholder="先生の名前で探す"
            />
          </Form>
          {/* -ml-3.5 lines the label up with the text above (subtle has no border to show). */}
          <div className="mt-2">
            <LinkButton variant="subtle" href="/teachers" className="-ml-3.5">
              先生一覧へ
              <Icon name="arrow" size={14} />
            </LinkButton>
          </div>
        </Card>
        <Card className="p-6 lg:col-start-2 lg:row-start-2">
          <h2 className="text-[17px] font-bold">今日の休み・行事</h2>
          {closures.length === 0 ? (
            <p className="mt-2 text-xs text-muted">ありません</p>
          ) : (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {closures.map((name) => (
                <Badge key={name} kind="warning">
                  {name}
                </Badge>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
