import Form from "next/form";
import { AutoSubmitInput, AutoSubmitSelect } from "@/components/ui/auto-submit";
import { LinkButton } from "@/components/ui/button";
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
        <span className="text-[23px] font-bold tracking-tight">
          {room.name}
        </span>
        {room.building && (
          <span className="rounded-[5px] bg-[#f1f5f7] px-1.5 py-0.5 text-[11px] text-[#78909f]">
            {room.building}
          </span>
        )}
      </div>
      <div className="mb-3 mt-0.5 text-[11px] text-muted">
        {room.note ?? KIND_LABEL[room.kind]}
      </div>
      {[first, second].map((slot) => (
        <div
          key={slot.no}
          className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5"
        >
          <span className="text-[11px] text-muted">{slot.half}</span>
          <SlotBadge status={room.slots[slot.no]} />
        </div>
      ))}
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
        description="日付と時限を選んで、教室ごとの前半・後半の状態を確認できます。"
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
        <Form action={basePath} className="flex flex-wrap items-center gap-2.5">
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
          />
          <AutoSubmitSelect
            key={`period-${periodNo}`}
            name="period"
            defaultValue={periodNo}
            aria-label="時限"
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
        <div className="sm:ml-auto">
          <Segmented
            label="空きで絞る"
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
          {MESSAGES.MW001(undecidedClasses.join("、"))}
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
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
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
        <TableWrap>
          <thead>
            <tr>
              <Th className="sticky left-0 z-10">教室</Th>
              {SLOTS.map((slot) => (
                <Th key={slot.no} highlight={slot.periodNo === periodNo}>
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
                <Td className="sticky left-0 z-10 bg-white">
                  <strong>{room.name}</strong>
                  <SubText>
                    {[room.building, room.note ?? KIND_LABEL[room.kind]]
                      .filter(Boolean)
                      .join("・")}
                  </SubText>
                </Td>
                {SLOTS.map((slot) => (
                  <Td key={slot.no}>
                    <SlotBadge status={room.slots[slot.no]} />
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      <Footnote>
        授業・予約に基づく表示です。実際の在室は検知していません。
      </Footnote>
    </>
  );
}
