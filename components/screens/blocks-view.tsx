import { Button } from "@/components/ui/button";
import {
  Field,
  FormActions,
  fieldClass,
  selectClass,
} from "@/components/ui/form";
import {
  Card,
  EmptyState,
  NotReadyNotice,
  PageHeading,
  SectionHead,
  SubText,
  TableWrap,
  Td,
  Th,
} from "@/components/ui/parts";
import { PERIODS } from "@/lib/domain/periods";

export type BlockRow = {
  id: string;
  room: string;
  rangeText: string;
  setBy: string;
  setText: string;
  overlapReservations: number;
  overlapLessons: number;
};

function Overlap({ row }: { row: BlockRow }) {
  return (
    <>
      承認済みの予約 {row.overlapReservations}件 / 授業 {row.overlapLessons}件
    </>
  );
}

function ReleaseAction({ size }: { size: "sm" | "md" }) {
  return (
    <Button size={size} variant="danger">
      解除
    </Button>
  );
}

// S13 使用止め
export function BlocksView({
  rows,
  rooms,
  today,
}: {
  rows: BlockRow[];
  rooms: { id: string; name: string }[];
  today: string;
}) {
  return (
    <div className="max-w-4xl">
      <PageHeading
        title="使用止め"
        description="教室を、日付と時限の範囲で予約できなくします。どの先生でも設定・解除できます。"
      />
      {/* Same width as the other entry forms (S06/S12/S14); the heading and the list
          below share it, so the right edges line up. The form is staged: the room,
          then 開始 and 終了
          (date + period each), then the button. Between md and lg (sidebar shown, about
          464px inside the card) 開始 and 終了 take a row each, so the dates are not cut.
          The room select is one grid column wide (half the row minus half the gap-4),
          so its right edge meets the 開始 pair; between md and lg it takes the full
          row like the date rows below it. */}
      <NotReadyNotice>
        画面の形を確かめる段階です。使用止めの表ができてから、設定できるようになります。
      </NotReadyNotice>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-bold">追加</h2>
        <form className="grid gap-4 sm:grid-cols-2">
          <Field label="教室" required full>
            <select
              name="room"
              defaultValue=""
              className={`${selectClass} sm:w-[calc(50%-0.5rem)] md:max-lg:w-full`}
            >
              <option value="" disabled>
                選んでください
              </option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2 md:max-lg:col-span-2">
            <Field label="開始日" required>
              <input
                type="date"
                name="startDate"
                min={today}
                defaultValue={today}
                className={fieldClass}
              />
            </Field>
            <Field label="開始の時限" required>
              <select name="startPeriod" className={selectClass}>
                {PERIODS.map((period) => (
                  <option key={period.no} value={period.no}>
                    {period.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2 md:max-lg:col-span-2">
            <Field label="終了日" required>
              <input
                type="date"
                name="endDate"
                min={today}
                defaultValue={today}
                className={fieldClass}
              />
            </Field>
            <Field label="終了の時限" required>
              <select name="endPeriod" defaultValue={4} className={selectClass}>
                {PERIODS.map((period) => (
                  <option key={period.no} value={period.no}>
                    {period.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <FormActions className="sm:col-span-2">
            <Button type="submit" variant="primary" disabled>
              設定する
            </Button>
          </FormActions>
        </form>
      </Card>

      <SectionHead
        title="終わっていない使用止め"
        description="指定した時限は、前半・後半の両方を止めます。"
      />
      {rows.length === 0 ? (
        <EmptyState title="使用止めはありません" icon="ban" />
      ) : (
        <>
          {/* The table fits from lg. Below that each block is a card, so 重なり and
            解除 are visible without scrolling sideways (as in the reservation lists). */}
          <div className="hidden lg:block">
            <TableWrap>
              <thead>
                <tr>
                  <Th>教室</Th>
                  <Th>開始・終了</Th>
                  <Th>設定した先生・日時</Th>
                  <Th>重なり</Th>
                  <Th>操作</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <strong>{row.room}</strong>
                    </Td>
                    <Td>{row.rangeText}</Td>
                    <Td>
                      {row.setBy}
                      <SubText>{row.setText}</SubText>
                    </Td>
                    <Td className="whitespace-normal">
                      <Overlap row={row} />
                    </Td>
                    <Td>
                      <ReleaseAction size="sm" />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
          <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
            {rows.map((row) => (
              <li key={row.id}>
                <Card className="flex h-full flex-col p-4 text-xs">
                  <strong className="text-sm">{row.room}</strong>
                  <SubText>{row.rangeText}</SubText>
                  <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
                    <dt className="text-muted">設定</dt>
                    <dd className="min-w-0">
                      {row.setBy}
                      <SubText>{row.setText}</SubText>
                    </dd>
                    <dt className="text-muted">重なり</dt>
                    <dd className="min-w-0">
                      <Overlap row={row} />
                    </dd>
                  </dl>
                  <div className="mt-auto flex justify-end pt-3.5">
                    <ReleaseAction size="md" />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
