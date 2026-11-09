import Form from "next/form";
import type { ReactNode } from "react";
import { AutoSubmitInput, AutoSubmitSelect } from "@/components/ui/auto-submit";
import { LinkButton } from "@/components/ui/button";
import { filterFieldClass, filterSelectClass } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Pager } from "@/components/ui/pager";
import { ReviewButtons } from "./review-buttons";
import { WithdrawButton } from "./withdraw-button";
import {
  Badge,
  Callout,
  Card,
  EmptyState,
  FilterBar,
  PageHeading,
  SubText,
  TableWrap,
  Td,
  Th,
  type BadgeKind,
} from "@/components/ui/parts";

// 予約の状態の表示名 (外部設計書 6-2).
export type ReservationStatus =
  "pending" | "approved" | "rejected" | "cancelled" | "withdrawn" | "expired";

const STATUS: Record<ReservationStatus, { label: string; kind: BadgeKind }> = {
  pending: { label: "承認待ち", kind: "warning" },
  approved: { label: "承認済み", kind: "available" },
  rejected: { label: "却下", kind: "error" },
  cancelled: { label: "取消", kind: "neutral" },
  withdrawn: { label: "取り下げ", kind: "neutral" },
  expired: { label: "期限切れ", kind: "neutral" },
};

export function StatusBadge({ status }: { status: ReservationStatus }) {
  const { label, kind } = STATUS[status];
  return <Badge kind={kind}>{label}</Badge>;
}

export type ReservationRow = {
  id: string;
  dateText: string;
  /** 3限前半〜4限後半(13:30-16:45) */
  slotText: string;
  room: string;
  purpose: string;
  note: string;
  applicant: string;
  createdText: string;
  status: ReservationStatus;
  handledBy: string | null;
  handledText: string | null;
  proxy: boolean;
  warnings: string[];
  /** Why it cannot be approved. "承認" cannot be pressed while there is any. */
  blockedReasons: string[];
  /** MC201: an approved reservation is on the same slots, so 承認 asks first. */
  needsConfirm?: boolean;
};

// Where a table does not fit, each reservation becomes a card instead: the state
// and the buttons must be visible without scrolling sideways. The tables have at
// most 6 columns (S11 merges 申請者・申請日時 and 状態・対応) and fit from xl (1280px).
const LAYOUT = {
  table: "hidden xl:block",
  cards: "grid gap-3 lg:grid-cols-2 xl:hidden",
} as const;

/** The date and the room are the key facts: they lead, in a larger size. */
function SlotSummary({ row }: { row: ReservationRow }) {
  return (
    <>
      <strong className="text-sm">
        {row.dateText}
        <span className="ml-2">{row.room}</span>
      </strong>
      <SubText>{row.slotText}</SubText>
    </>
  );
}

function StatusCell({ row }: { row: ReservationRow }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <StatusBadge status={row.status} />
      {row.proxy && <Badge kind="neutral">代理</Badge>}
    </span>
  );
}

function HandledCell({ row }: { row: ReservationRow }) {
  return (
    <>
      {row.handledBy ?? "—"}
      {row.handledText && <SubText>{row.handledText}</SubText>}
    </>
  );
}

function PurposeCell({ row }: { row: ReservationRow }) {
  return (
    <>
      {row.purpose}
      {row.note && <SubText>{row.note}</SubText>}
    </>
  );
}

// Compact buttons in table rows; full-size ones, further apart, in cards (touch).
type ActionSize = "sm" | "md";

function ReviewActions({
  row,
  size = "sm",
}: {
  row: ReservationRow;
  size?: ActionSize;
}) {
  return (
    <ReviewButtons
      id={row.id}
      status={row.status}
      blocked={row.blockedReasons.length > 0}
      needsConfirm={row.needsConfirm === true}
      size={size}
    />
  );
}

function ReviewNotes({ row }: { row: ReservationRow }) {
  return (
    <>
      {row.warnings.map((text) => (
        <span key={text} className="text-[11px] text-amber-ink">
          {text}
        </span>
      ))}
      {row.blockedReasons.map((text) => (
        <span key={text} className="text-[11px] text-red-ink">
          {text}
        </span>
      ))}
    </>
  );
}

function hasNotes(row: ReservationRow) {
  return row.warnings.length > 0 || row.blockedReasons.length > 0;
}

function CardField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

function ReservationCard({
  row,
  showStatus,
  fields,
  notes,
  actions,
}: {
  row: ReservationRow;
  showStatus: boolean;
  fields: ReactNode;
  notes?: ReactNode;
  actions: ReactNode;
}) {
  return (
    <li>
      <Card className="flex h-full flex-col p-4 text-xs">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <SlotSummary row={row} />
          </div>
          {showStatus && (
            <div className="flex shrink-0 items-center">
              <StatusCell row={row} />
            </div>
          )}
        </div>
        <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
          {fields}
        </dl>
        {notes && (
          <div className="mt-3 flex flex-col gap-1 text-pretty">{notes}</div>
        )}
        {actions && (
          <div className="mt-auto flex justify-end pt-3.5">{actions}</div>
        )}
      </Card>
    </li>
  );
}

// S07 自分の予約
export function MyReservationsView({
  rows,
  notice,
  page,
  hasNext,
}: {
  rows: ReservationRow[];
  /** MI101 / MI102: what was just done */
  notice?: string | null;
  page: number;
  hasNext: boolean;
}) {
  return (
    <>
      <PageHeading
        title="自分の予約"
        actions={
          <LinkButton variant="primary" href="/reservations/new">
            <Icon name="plus" size={16} />
            予約する
          </LinkButton>
        }
      />
      {notice && (
        <Callout icon="check" className="mb-5" key={notice}>
          {notice}
        </Callout>
      )}
      {rows.length === 0 ? (
        <EmptyState
          title="まだ予約はありません"
          icon="file"
          action={<LinkButton href="/rooms">空き教室を見る</LinkButton>}
        />
      ) : (
        <>
          <div className={LAYOUT.table}>
            <TableWrap>
              <thead>
                <tr>
                  <Th>日付・枠・教室</Th>
                  <Th>用途・備考</Th>
                  <Th>状態</Th>
                  <Th>対応した先生・日時</Th>
                  <Th>申請日時</Th>
                  <Th>操作</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <SlotSummary row={row} />
                    </Td>
                    <Td>
                      <PurposeCell row={row} />
                    </Td>
                    <Td>
                      <StatusCell row={row} />
                    </Td>
                    <Td>
                      <HandledCell row={row} />
                    </Td>
                    <Td>{row.createdText}</Td>
                    <Td>
                      {row.status === "pending" ? (
                        <WithdrawButton id={row.id} />
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
          <ul className={LAYOUT.cards}>
            {rows.map((row) => (
              <ReservationCard
                key={row.id}
                row={row}
                showStatus
                fields={
                  <>
                    <CardField label="用途">
                      <PurposeCell row={row} />
                    </CardField>
                    <CardField label="申請日時">{row.createdText}</CardField>
                    {row.handledBy && (
                      <CardField label="対応">
                        <HandledCell row={row} />
                      </CardField>
                    )}
                  </>
                }
                actions={
                  row.status === "pending" ? (
                    <WithdrawButton id={row.id} size="md" />
                  ) : null
                }
              />
            ))}
          </ul>
          <Pager basePath="/reservations" page={page} hasNext={hasNext} />
        </>
      )}
    </>
  );
}

function ReviewTable({
  rows,
  showHandled,
}: {
  rows: ReservationRow[];
  showHandled: boolean;
}) {
  const hasActions = (row: ReservationRow) =>
    row.status === "pending" || row.status === "approved";
  return (
    <>
      <div className={LAYOUT.table}>
        <TableWrap>
          <thead>
            <tr>
              <Th>日付・枠・教室</Th>
              <Th>用途・備考</Th>
              {showHandled ? (
                <>
                  <Th>申請者・申請日時</Th>
                  <Th>状態・対応</Th>
                </>
              ) : (
                <>
                  <Th>申請者</Th>
                  <Th>申請日時</Th>
                </>
              )}
              <Th>警告・理由</Th>
              <Th>操作</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <Td>
                  <SlotSummary row={row} />
                </Td>
                <Td>
                  <PurposeCell row={row} />
                </Td>
                {showHandled ? (
                  <>
                    <Td>
                      {row.applicant}
                      <SubText>{row.createdText}</SubText>
                    </Td>
                    <Td>
                      <StatusCell row={row} />
                      {row.handledBy && (
                        <SubText>
                          {row.handledBy}
                          {row.handledText && ` ${row.handledText}`}
                        </SubText>
                      )}
                    </Td>
                  </>
                ) : (
                  <>
                    <Td>{row.applicant}</Td>
                    <Td>{row.createdText}</Td>
                  </>
                )}
                <Td className="whitespace-normal">
                  <div className="flex min-w-[180px] flex-col gap-1 text-pretty">
                    {hasNotes(row) ? (
                      <ReviewNotes row={row} />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </div>
                </Td>
                <Td>
                  {hasActions(row) ? (
                    <ReviewActions row={row} />
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </div>
      <ul className={LAYOUT.cards}>
        {rows.map((row) => (
          <ReservationCard
            key={row.id}
            row={row}
            showStatus={showHandled}
            fields={
              <>
                <CardField label="用途">
                  <PurposeCell row={row} />
                </CardField>
                <CardField label="申請者">{row.applicant}</CardField>
                <CardField label="申請日時">{row.createdText}</CardField>
                {showHandled && row.handledBy && (
                  <CardField label="対応">
                    <HandledCell row={row} />
                  </CardField>
                )}
              </>
            }
            notes={hasNotes(row) ? <ReviewNotes row={row} /> : null}
            actions={
              hasActions(row) ? <ReviewActions row={row} size="md" /> : null
            }
          />
        ))}
      </ul>
    </>
  );
}

// S10 先生ホーム(承認待ち)
export function TeacherHomeView({
  rows,
  total,
  notice,
  page,
  hasNext,
}: {
  rows: ReservationRow[];
  /** All the requests waiting, not only this page */
  total: number;
  notice?: string | null;
  page: number;
  hasNext: boolean;
}) {
  return (
    <>
      <PageHeading
        title="先生ホーム"
        actions={
          <>
            <LinkButton href="/teacher/reservations">予約の一覧</LinkButton>
            <LinkButton variant="primary" href="/teacher/reservations/new">
              <Icon name="plus" size={16} />
              代理入力
            </LinkButton>
            <LinkButton href="/teacher/blocks">使用止め</LinkButton>
          </>
        }
      />
      <Callout icon="check">
        承認待ち <strong className="font-semibold">{total}</strong> 件。
        却下の理由は、システムの外(チャットやメール)で伝えてください。
      </Callout>
      {notice && (
        <Callout icon="check" className="mb-5" key={notice}>
          {notice}
        </Callout>
      )}
      {rows.length === 0 ? (
        <EmptyState title="承認待ちの予約はありません" icon="check" />
      ) : (
        <>
          <ReviewTable rows={rows} showHandled={false} />
          <Pager basePath="/teacher" page={page} hasNext={hasNext} />
        </>
      )}
    </>
  );
}

// S11 予約の一覧(先生)
export function TeacherReservationsView({
  rows,
  rooms,
  status,
  roomId,
  start,
  end,
  basePath = "/teacher/reservations",
  notice,
  page,
  hasNext,
  fromBlock = false,
}: {
  rows: ReservationRow[];
  rooms: { id: string; name: string }[];
  status: string;
  roomId: string;
  start: string;
  end: string;
  basePath?: string;
  notice?: string | null;
  page: number;
  hasNext: boolean;
  /** Opened from S13: only the approved reservations that touch the 使用止め. */
  fromBlock?: boolean;
}) {
  return (
    <>
      <PageHeading
        title="予約の一覧"
        actions={
          <LinkButton variant="primary" href="/teacher/reservations/new">
            <Icon name="plus" size={16} />
            代理入力
          </LinkButton>
        }
      />
      <FilterBar>
        {/* Phones: one full-width row per filter. sm to lg: the two selects share a row
            and the date range has its own (so 〜 never ends a line alone and no row holds
            a single narrow control). From lg: one row. grid-cols-1 caps the track at the
            bar width, so the 16px date inputs shrink instead of widening the bar. */}
        <Form
          action={basePath}
          className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5 lg:flex lg:w-auto lg:flex-wrap lg:items-center"
        >
          <AutoSubmitSelect
            name="status"
            defaultValue={status}
            aria-label="状態"
            className={`${filterSelectClass} w-full lg:w-auto`}
          >
            <option value="">すべての状態</option>
            {(Object.keys(STATUS) as ReservationStatus[]).map((key) => (
              <option key={key} value={key}>
                {STATUS[key].label}
              </option>
            ))}
          </AutoSubmitSelect>
          <AutoSubmitSelect
            name="room"
            defaultValue={roomId}
            aria-label="教室"
            className={`${filterSelectClass} w-full lg:w-auto`}
          >
            <option value="">すべての教室</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </AutoSubmitSelect>
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-1">
            <AutoSubmitInput
              key={`start-${start}`}
              type="date"
              name="start"
              defaultValue={start}
              aria-label="開始日"
              className={`${filterFieldClass} min-w-0 flex-1 lg:flex-none`}
            />
            <span className="shrink-0 text-xs text-muted">〜</span>
            <AutoSubmitInput
              key={`end-${end}`}
              type="date"
              name="end"
              defaultValue={end}
              aria-label="終了日"
              className={`${filterFieldClass} min-w-0 flex-1 lg:flex-none`}
            />
          </div>
          <noscript>
            <button type="submit">絞り込む</button>
          </noscript>
        </Form>
      </FilterBar>
      {fromBlock && (
        <Callout kind="neutral" icon="info">
          使用止めと重なる、承認済みの予約だけを出しています。
          <LinkButton size="sm" href={basePath} className="ml-3">
            すべて見る
          </LinkButton>
        </Callout>
      )}
      {notice && (
        <Callout icon="check" className="mb-5" key={notice}>
          {notice}
        </Callout>
      )}
      {rows.length === 0 ? (
        <EmptyState title="表示する予約はありません" />
      ) : (
        <>
          <ReviewTable rows={rows} showHandled />
          <Pager
            basePath={basePath}
            page={page}
            hasNext={hasNext}
            params={{ status, start, end, room: roomId }}
          />
        </>
      )}
    </>
  );
}
