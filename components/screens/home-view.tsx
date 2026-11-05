import Form from "next/form";
import {
  MyClassSelect,
  type ClassOption,
} from "@/components/shell/my-class-select";
import { LinkButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Badge, Callout, Card, PageHeading } from "@/components/ui/parts";
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

function NextLessonCard({
  selected,
  lessons,
  today,
  timetableHref,
}: {
  selected: boolean;
  lessons: HomeLessons;
  today: string;
  timetableHref: string;
}) {
  const next = lessons.kind === "ready" ? lessons.next : null;
  return (
    <Card className="border-[#d7e9e2] bg-linear-to-r from-[#eef7f4] to-[#f7fbfa] p-6 sm:px-7">
      <div className="flex items-center gap-2 text-[11px] font-bold tracking-wide text-teal">
        <Icon name="calendar" size={15} />
        次の授業
      </div>
      {!selected ? (
        <h2 className="mb-6 mt-5 text-[19px] font-bold">
          クラスを選ぶと、次の授業が出ます
        </h2>
      ) : next ? (
        <div className="mt-3">
          <div className="text-[44px] font-bold leading-tight tracking-tight text-navy sm:text-[52px]">
            {roomText(next.room)}
            {next.room && (
              <span className="ml-2 text-[19px] font-semibold tracking-normal">
                教室
              </span>
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="text-base font-bold">{next.subject}</span>
            <LessonBadges lesson={next} />
          </div>
          <div className="mb-5 mt-1.5 flex flex-wrap gap-4 text-xs text-[#617e7c]">
            {next.date !== today && <span>{formatDate(next.date, today)}</span>}
            <span>
              {periodLabel(next.periodNo)} {periodTime(next.periodNo)}
            </span>
            <span>{teacherText(next.teachers)}</span>
          </div>
        </div>
      ) : (
        <div className="mb-5 mt-3">
          <div className="text-[44px] font-bold leading-tight text-navy sm:text-[52px]">
            未定
          </div>
          <p className="mt-2 text-xs text-[#617e7c]">
            入力済みの時間割の範囲で、次の授業が見つかりません。
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <LinkButton variant="primary" href={timetableHref}>
          今日の時間割を見る
          <Icon name="arrow" size={15} />
        </LinkButton>
        <LinkButton href="/rooms">空き教室を見る</LinkButton>
      </div>
    </Card>
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
  const current = lessons.kind === "ready" ? lessons.current : null;
  return (
    <>
      <PageHeading
        title="次の教室を、すぐに。"
        description="自分のクラスの授業と、今日の予定を確認できます。"
        actions={
          <>
            <MyClassSelect
              classes={classes}
              selectedId={selectedClassId}
              todayFiscalYear={todayFiscalYear}
              emptyLabel="選んでください"
            />
            <LinkButton variant="primary" href="/reservations/new">
              <Icon name="plus" size={16} />
              予約する
            </LinkButton>
          </>
        }
      />
      {yearChanged ? (
        <Callout kind="warning">{MESSAGES.MI002}</Callout>
      ) : (
        !selectedClassId && <Callout>{MESSAGES.MI001}</Callout>
      )}

      <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <NextLessonCard
          selected={selectedClassId !== null}
          lessons={lessons}
          today={today}
          timetableHref={withQuery("/timetable", {
            class: selectedClassId,
            date: today,
          })}
        />
        <Card className="flex flex-col justify-center p-6">
          <div className="text-[11px] font-bold tracking-[0.12em] text-teal">
            先生の位置
          </div>
          <h2 className="mt-2 text-[17px] font-bold">先生は、どこにいる?</h2>
          <p className="mb-4 mt-1.5 text-xs text-muted">
            質問・相談の前に、居場所を確認できます。
          </p>
          <Form action="/teachers" className="relative">
            <Icon
              name="search"
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#91a1ad]"
            />
            <input
              name="q"
              aria-label="探したい先生の名前"
              placeholder="先生の名前で探す"
              className="h-[42px] w-full rounded-lg border border-line bg-[#fbfcfd] pl-9 pr-3 text-xs"
            />
          </Form>
          <div className="mt-3">
            <LinkButton variant="subtle" size="sm" href="/teachers">
              先生一覧へ
              <Icon name="arrow" size={14} />
            </LinkButton>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-base font-bold">いまの授業</h2>
          {!selectedClassId ? (
            <p className="mt-2 text-xs text-muted">{MESSAGES.MI001}</p>
          ) : lessons.kind === "undecided" ? (
            <p className="mt-2 text-xs text-muted">未定</p>
          ) : current ? (
            <div className="mt-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{current.subject}</span>
                <LessonBadges lesson={current} />
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                <span>
                  {periodLabel(current.periodNo)} {periodTime(current.periodNo)}
                </span>
                <span>{roomText(current.room)}</span>
                <span>{teacherText(current.teachers)}</span>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted">{MESSAGES.MI003}</p>
          )}
        </Card>
        <Card className="p-6">
          <h2 className="text-base font-bold">今日の休み・行事</h2>
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
