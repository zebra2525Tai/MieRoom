import Form from "next/form";
import { AutoSubmitInput, AutoSubmitSelect } from "@/components/ui/auto-submit";
import { Button, LinkButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Badge,
  Callout,
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
  /** Why it cannot be approved. "承認" cannot be pressed while this is set. */
  blockedReason: string | null;
};

const NOT_READY = "予約の表ができるまで、ここには何も出ません。";

// S07 自分の予約
export function MyReservationsView({ rows }: { rows: ReservationRow[] }) {
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
      {rows.length === 0 ? (
        <EmptyState
          title="まだ予約はありません"
          action={<LinkButton href="/rooms">空き教室を見る</LinkButton>}
        >
          {NOT_READY}
        </EmptyState>
      ) : (
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
                  <strong>{row.dateText}</strong>
                  <SubText>
                    {row.slotText} / {row.room}
                  </SubText>
                </Td>
                <Td>
                  {row.purpose}
                  {row.note && <SubText>{row.note}</SubText>}
                </Td>
                <Td>
                  <StatusBadge status={row.status} />
                  {row.proxy && <SubText>代理</SubText>}
                </Td>
                <Td>
                  {row.handledBy ?? "—"}
                  {row.handledText && <SubText>{row.handledText}</SubText>}
                </Td>
                <Td>{row.createdText}</Td>
                <Td>
                  {row.status === "pending" ? (
                    <Button size="sm" variant="danger">
                      取り下げ
                    </Button>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
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
  return (
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
              <strong>{row.dateText}</strong>
              <SubText>
                {row.slotText} / {row.room}
              </SubText>
            </Td>
            <Td>
              {row.purpose}
              {row.note && <SubText>{row.note}</SubText>}
            </Td>
            <Td>{row.applicant}</Td>
            <Td>{row.createdText}</Td>
            {showHandled && (
              <Td>
                <StatusBadge status={row.status} />
                {row.proxy && <SubText>代理</SubText>}
              </Td>
            )}
            {showHandled && (
              <Td>
                {row.handledBy ?? "—"}
                {row.handledText && <SubText>{row.handledText}</SubText>}
              </Td>
            )}
            <Td className="whitespace-normal">
              <div className="flex min-w-[180px] flex-col gap-1">
                {row.warnings.map((text) => (
                  <span key={text} className="text-[11px] text-amber-ink">
                    {text}
                  </span>
                ))}
                {row.blockedReason && (
                  <span className="text-[11px] text-red-ink">
                    {row.blockedReason}
                  </span>
                )}
                {row.warnings.length === 0 && !row.blockedReason && (
                  <span className="text-muted">—</span>
                )}
              </div>
            </Td>
            <Td>
              {row.status === "pending" ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={row.blockedReason !== null}
                  >
                    承認
                  </Button>
                  <Button size="sm" variant="danger">
                    却下
                  </Button>
                </div>
              ) : row.status === "approved" ? (
                <Button size="sm" variant="danger">
                  取消
                </Button>
              ) : (
                <span className="text-muted">—</span>
              )}
            </Td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}

// S10 先生ホーム(承認待ち)
export function TeacherHomeView({ rows }: { rows: ReservationRow[] }) {
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
        承認待ち <strong className="font-semibold">{rows.length}</strong> 件。
        却下の理由は、システムの外(チャットやメール)で伝えてください。
      </Callout>
      {rows.length === 0 ? (
        <EmptyState title="承認待ちの予約はありません">{NOT_READY}</EmptyState>
      ) : (
        <ReviewTable rows={rows} showHandled={false} />
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
}: {
  rows: ReservationRow[];
  rooms: { id: string; name: string }[];
  status: string;
  roomId: string;
  start: string;
  end: string;
  basePath?: string;
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
      {rows.length === 0 ? (
        <EmptyState title="表示する予約はありません">{NOT_READY}</EmptyState>
      ) : (
        <ReviewTable rows={rows} showHandled />
      )}
    </>
  );
}
