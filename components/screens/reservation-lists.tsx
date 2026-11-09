import Form from "next/form";
import type { ReactNode } from "react";
import { AutoSubmitInput, AutoSubmitSelect } from "@/components/ui/auto-submit";
import { LinkButton } from "@/components/ui/button";
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
// and the buttons must be visible without scrolling sideways. The 6-column tables
// fit from xl (1280px); the 8-column one of S11 needs 2xl (1536px).
// Written out in full so that Tailwind finds the class names.
const LAYOUT = {
  xl: {
    table: "hidden xl:block",
    cards: "grid gap-3 lg:grid-cols-2 xl:hidden",
  },
  "2xl": {
    table: "hidden 2xl:block",
    cards: "grid gap-3 lg:grid-cols-2 2xl:hidden",
  },
} as const;

function SlotSummary({ row }: { row: ReservationRow }) {
  return (
    <>
      <strong>{row.dateText}</strong>
      <SubText>
        {row.slotText} / {row.room}
      </SubText>
    </>
  );
}

function StatusCell({ row }: { row: ReservationRow }) {
  return (
    <>
      <StatusBadge status={row.status} />
      {row.proxy && <SubText>代理</SubText>}
    </>
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

function ReviewActions({ row }: { row: ReservationRow }) {
  return (
    <ReviewButtons
      id={row.id}
      status={row.status}
      blocked={row.blockedReasons.length > 0}
      needsConfirm={row.needsConfirm === true}
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
            <div className="shrink-0 text-right">
              <StatusCell row={row} />
            </div>
          )}
        </div>
        <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
          {fields}
        </dl>
        {notes && <div className="mt-3 flex flex-col gap-1">{notes}</div>}
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
        description="申請した予約の状態を確認できます。承認待ちの間は、取り下げられます。"
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
          action={<LinkButton href="/rooms">空き教室を見る</LinkButton>}
        />
      ) : (
        <>
          <div className={LAYOUT.xl.table}>
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
          <ul className={LAYOUT.xl.cards}>
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
                    <WithdrawButton id={row.id} />
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
  // The two extra columns of S11 make the table about 300px wider.
  const layout = showHandled ? LAYOUT["2xl"] : LAYOUT.xl;
  return (
    <>
      <div className={layout.table}>
        <TableWrap>
          <thead>
            <tr>
              <Th>日付・枠・教室</Th>
              <Th>用途・備考</Th>
              <Th>申請者</Th>
              <Th>申請日時</Th>
              {showHandled && <Th>状態</Th>}
              {showHandled && <Th>対応した先生・日時</Th>}
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
                <Td>{row.applicant}</Td>
                <Td>{row.createdText}</Td>
                {showHandled && (
                  <Td>
                    <StatusCell row={row} />
                  </Td>
                )}
                {showHandled && (
                  <Td>
                    <HandledCell row={row} />
                  </Td>
                )}
                <Td className="whitespace-normal">
                  <div className="flex min-w-[180px] flex-col gap-1">
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
      <ul className={layout.cards}>
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
            actions={hasActions(row) ? <ReviewActions row={row} /> : null}
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
        description="承認待ちの予約を、日付と最初の枠の早い順に出します。どの先生でも承認・却下できます。"
        actions={
          <>
            <LinkButton href="/teacher/reservations">予約の一覧</LinkButton>
            <LinkButton href="/teacher/reservations/new">代理入力</LinkButton>
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
        <EmptyState title="承認待ちの予約はありません" />
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
        description="状態・期間・教室で絞って、予約を確認・承認・取消できます。"
        actions={
          <LinkButton variant="primary" href="/teacher/reservations/new">
            <Icon name="plus" size={16} />
            代理入力
          </LinkButton>
        }
      />
      <FilterBar>
        <Form action={basePath} className="flex flex-wrap items-center gap-2.5">
          <AutoSubmitSelect
            name="status"
            defaultValue={status}
            aria-label="状態"
          >
            <option value="">すべての状態</option>
            {(Object.keys(STATUS) as ReservationStatus[]).map((key) => (
              <option key={key} value={key}>
                {STATUS[key].label}
              </option>
            ))}
          </AutoSubmitSelect>
          <AutoSubmitInput
            key={`start-${start}`}
            type="date"
            name="start"
            defaultValue={start}
            aria-label="開始日"
          />
          <span className="text-xs text-muted">〜</span>
          <AutoSubmitInput
            key={`end-${end}`}
            type="date"
            name="end"
            defaultValue={end}
            aria-label="終了日"
          />
          <AutoSubmitSelect name="room" defaultValue={roomId} aria-label="教室">
            <option value="">すべての教室</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </AutoSubmitSelect>
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
