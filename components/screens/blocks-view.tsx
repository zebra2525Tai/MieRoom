import { Button } from "@/components/ui/button";
import { Field, fieldClass } from "@/components/ui/form";
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
    <>
      <PageHeading
        title="使用止め"
        description="教室を、日付と時限の範囲で予約できなくします。どの先生でも設定・解除できます。"
      />
      <NotReadyNotice>
        画面の形を確かめる段階です。使用止めの表ができてから、設定できるようになります。
      </NotReadyNotice>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 text-base font-bold">追加</h2>
        <form className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_minmax(0,1fr)_110px_auto] md:items-end">
          <Field label="教室" required>
            <select name="room" defaultValue="" className={fieldClass}>
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
            <select name="startPeriod" className={fieldClass}>
              {PERIODS.map((period) => (
                <option key={period.no} value={period.no}>
                  {period.label}
                </option>
              ))}
            </select>
          </Field>
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
            <select name="endPeriod" defaultValue={4} className={fieldClass}>
              {PERIODS.map((period) => (
                <option key={period.no} value={period.no}>
                  {period.label}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" variant="primary" className="h-[41px]" disabled>
            設定する
          </Button>
        </form>
      </Card>

      <SectionHead
        title="終わっていない使用止め"
        description="指定した時限は、前半・後半の両方を止めます。"
      />
      {rows.length === 0 ? (
        <EmptyState title="使用止めはありません" />
      ) : (
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
                <Td>
                  承認済みの予約 {row.overlapReservations}件 / 授業{" "}
                  {row.overlapLessons}件
                </Td>
                <Td>
                  <Button size="sm" variant="danger">
                    解除
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
