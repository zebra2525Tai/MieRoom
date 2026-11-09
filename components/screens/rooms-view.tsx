import Form from "next/form";
import { Fragment } from "react";
import { AutoSubmitInput, AutoSubmitSelect } from "@/components/ui/auto-submit";
import { LinkButton } from "@/components/ui/button";
import { filterFieldClass, filterSelectClass } from "@/components/ui/form";
import {
  Badge,
  Callout,
  Card,
  EmptyState,
  FilterBar,
  Footnote,
  PageHeading,
  Segmented,
  SubText,
  TableWrap,
  Td,
  Th,
  type BadgeKind,
} from "@/components/ui/parts";
import {
  PERIODS,
  SLOTS,
  slotsOfPeriod,
  type PeriodNo,
} from "@/lib/domain/periods";
import {
  slotStatusLabel,
  type RoomKind,
  type RoomRow,
  type SlotStatus,
} from "@/lib/domain/room-status";
import { addDays, formatDate } from "@/lib/domain/school-date";
import { MESSAGES } from "@/lib/messages";
import { withQuery } from "@/lib/url";
import { ScrollToSelectedColumn } from "./rooms-scroll";

const STATUS_KIND: Record<SlotStatus["kind"], BadgeKind> = {
  free: "available",
  pending: "warning",
  reserved: "busy",
  lesson: "neutral",
  blocked: "error",
};

export function SlotBadge({ status }: { status: SlotStatus }) {
  return (
    <Badge kind={STATUS_KIND[status.kind]}>{slotStatusLabel(status)}</Badge>
  );
}

/**
 * A slot's status in a narrow cell or card: a lesson shows a short 授業 badge with the
 * class name on its own line below, so a long class name wraps instead of widening the
 * column (S04 時限表) or overflowing the card. Other statuses are the plain badge.
 */
function SlotStatusDetail({
  status,
  align = "start",
}: {
  status: SlotStatus;
  align?: "start" | "end";
}) {
  if (status.kind !== "lesson") return <SlotBadge status={status} />;
  return (
    <span
      className={`flex min-w-0 flex-col gap-0.5 ${align === "end" ? "items-end text-right" : "items-start"}`}
    >
      <Badge kind={STATUS_KIND.lesson}>授業</Badge>
      <span className="whitespace-normal text-[11px] leading-snug text-muted">
        {status.className}
      </span>
    </span>
  );
}

export const KIND_LABEL: Record<RoomKind, string> = {
  HOMEROOM: "ホームルーム",
  FREE: "空き教室",
};

function RoomCard({
  room,
  periodNo,
  reserveHref,
}: {
  room: RoomRow;
  periodNo: PeriodNo;
  reserveHref: string | null;
}) {
  const [first, second] = slotsOfPeriod(periodNo);
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-center justify-between gap-1.5">
        <span className="min-w-0 text-[23px] font-bold tracking-tight">
          {room.name}
        </span>
        {room.building && (
          <span className="shrink-0 rounded-[5px] bg-[#edf0f5] px-1.5 py-0.5 text-[11px] text-[#586579]">
            {room.building}
          </span>
        )}
      </div>
      <div className="mb-3 mt-0.5 text-[11px] text-muted">
        {room.note ?? KIND_LABEL[room.kind]}
      </div>
      {/* flex-1: the reserve buttons line up at the bottom of a row of cards. */}
      <div className="flex-1">
        {[first, second].map((slot) => (
          <div
            key={slot.no}
            className="mt-1 flex items-start justify-between gap-2"
          >
            <span className="shrink-0 py-1 text-[11px] leading-tight text-muted">
              {slot.half}
            </span>
            <SlotStatusDetail status={room.slots[slot.no]} align="end" />
          </div>
        ))}
      </div>
      {reserveHref && (
        <LinkButton size="sm" href={reserveHref} className="mt-3">
          この教室を予約
        </LinkButton>
      )}
    </Card>
  );
}

// S04 空き教室
export function RoomsView({
  date,
  today,
  periodNo,
  onlyFree,
  kind,
  building,
  layout,
  rooms,
  buildings,
  undecidedClasses,
  canApply,
  basePath = "/rooms",
}: {
  date: string;
  today: string;
  periodNo: PeriodNo;
  onlyFree: boolean;
  kind: RoomKind | null;
  building: string | null;
  layout: "cards" | "table";
  rooms: RoomRow[];
  buildings: string[];
  undecidedClasses: string[];
  /** 申請できる日 (R4-2, R4-3): the reserve button is offered only then. */
  canApply: boolean;
  basePath?: string;
}) {
  const state = {
    date,
    period: periodNo,
    kind,
    building,
    all: onlyFree ? null : 1,
    layout: layout === "table" ? "table" : null,
  };
  const reserveHref = (roomId: string) =>
    canApply
      ? withQuery("/reservations/new", {
          room: roomId,
          date,
          period: periodNo,
        })
      : null;

  return (
    <>
      <PageHeading
        title="空き教室"
        actions={
          <Segmented
            label="表示方法"
            items={[
              {
                label: "カード",
                href: withQuery(basePath, { ...state, layout: null }),
                active: layout === "cards",
              },
              {
                label: "時限表",
                href: withQuery(basePath, { ...state, layout: "table" }),
                active: layout === "table",
              },
            ]}
          />
        }
      />
      <FilterBar>
        {/* Phones and tablets: an even two-column grid. From lg: one row. */}
        <Form
          action={basePath}
          className="grid w-full grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-wrap lg:items-center lg:gap-2.5"
        >
          {!onlyFree && <input type="hidden" name="all" value="1" />}
          {layout === "table" && (
            <input type="hidden" name="layout" value="table" />
          )}
          <AutoSubmitInput
            key={date}
            type="date"
            name="date"
            min={today}
            max={addDays(today, 30)}
            defaultValue={date}
            aria-label="日付"
            className={`${filterFieldClass} w-full lg:w-auto`}
          />
          <AutoSubmitSelect
            key={`period-${periodNo}`}
            name="period"
            defaultValue={periodNo}
            aria-label="時限"
            className={`${filterSelectClass} w-full lg:w-auto`}
          >
            {PERIODS.map((period) => (
              <option key={period.no} value={period.no}>
                {period.label} {period.start}-{period.end}
              </option>
            ))}
          </AutoSubmitSelect>
          <AutoSubmitSelect
            key={`kind-${kind ?? ""}`}
            name="kind"
            defaultValue={kind ?? ""}
            aria-label="分類"
            className={`${filterSelectClass} w-full lg:w-auto`}
          >
            <option value="">すべての分類</option>
            <option value="HOMEROOM">ホームルーム</option>
            <option value="FREE">空き教室</option>
          </AutoSubmitSelect>
          <AutoSubmitSelect
            key={`building-${building ?? ""}`}
            name="building"
            defaultValue={building ?? ""}
            aria-label="フロア"
            className={`${filterSelectClass} w-full lg:w-auto`}
          >
            <option value="">すべてのフロア</option>
            {buildings.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </AutoSubmitSelect>
          <noscript>
            <button type="submit">絞り込む</button>
          </noscript>
        </Form>
        <div className="w-full lg:ml-auto lg:w-auto">
          <Segmented
            label="空きで絞る"
            stretch
            items={[
              {
                label: "空きだけ",
                href: withQuery(basePath, { ...state, all: null }),
                active: onlyFree,
              },
              {
                label: "すべて",
                href: withQuery(basePath, { ...state, all: 1 }),
                active: !onlyFree,
              },
            ]}
          />
        </div>
      </FilterBar>

      {undecidedClasses.length > 0 && (
        <Callout kind="warning">
          <UndecidedClassesMessage classes={undecidedClasses} />
        </Callout>
      )}

      <div className="my-3 text-xs text-muted">
        {formatDate(date, today)} / {rooms.length}教室を表示
      </div>

      {rooms.length === 0 ? (
        <EmptyState
          title="条件に合う教室がありません"
          action={
            <LinkButton href={withQuery(basePath, { date, period: periodNo })}>
              絞り込みを解除
            </LinkButton>
          }
        >
          分類やフロアの条件を変えてください。
        </EmptyState>
      ) : layout === "cards" ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              periodNo={periodNo}
              reserveHref={reserveHref(room.id)}
            />
          ))}
        </div>
      ) : (
        // Fixed, even columns: 教室 + 8 slots of 104px (982px from sm) fit the
        // 1072px content box at 1366. Narrower screens scroll sideways, opening
        // on the chosen period.
        <ScrollToSelectedColumn selected={periodNo}>
          <TableWrap tableClassName="table-fixed">
            <colgroup>
              <col className="w-[112px] sm:w-[150px]" />
              {SLOTS.map((slot) => (
                <col key={slot.no} className="w-[104px]" />
              ))}
            </colgroup>
            <thead>
              <tr>
                <Th stickyLeft>教室</Th>
                {SLOTS.map((slot) => (
                  <Th
                    key={slot.no}
                    highlight={slot.periodNo === periodNo}
                    data-selected={slot.periodNo === periodNo || undefined}
                  >
                    {slot.label}
                    <span className="mt-0.5 block font-normal">
                      {slot.start}-{slot.end}
                    </span>
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id}>
                  <Td stickyLeft className="whitespace-normal">
                    <strong>{room.name}</strong>
                    <SubText>
                      {[room.building, room.note ?? KIND_LABEL[room.kind]]
                        .filter(Boolean)
                        .join("・")}
                    </SubText>
                  </Td>
                  {SLOTS.map((slot) => (
                    <Td
                      key={slot.no}
                      className={
                        slot.periodNo === periodNo ? "bg-[#f2f5ff]" : ""
                      }
                    >
                      <SlotStatusDetail status={room.slots[slot.no]} />
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </ScrollToSelectedColumn>
      )}
      <Footnote>
        授業・予約に基づく表示です。実際の在室は検知していません。
      </Footnote>
    </>
  );
}

/** MW001 with each class name kept on one line, so a name such as 医療情報1年
 *  never splits; lines break only between names or around the parentheses.
 *  The wording itself still comes from MESSAGES. */
function UndecidedClassesMessage({ classes }: { classes: string[] }) {
  const marker = "\u0000";
  const [before, after = ""] = MESSAGES.MW001(marker).split(marker);
  return (
    <>
      {before}
      {classes.map((name, index) => (
        <Fragment key={name}>
          {index > 0 && "、"}
          <span className="whitespace-nowrap">{name}</span>
        </Fragment>
      ))}
      {after}
    </>
  );
}
