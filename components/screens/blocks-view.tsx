import { LinkButton } from "@/components/ui/button";
import {
  Callout,
  Card,
  EmptyState,
  PageHeading,
  SectionHead,
  SubText,
  TableWrap,
  Td,
  Th,
} from "@/components/ui/parts";
import { MESSAGES } from "@/lib/messages";
import { withQuery } from "@/lib/url";
import { BlockForm } from "./block-form";
import { ReleaseBlockButton } from "./review-buttons";

export type BlockRow = {
  id: string;
  roomId: string;
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
  notice,
  overlaps,
}: {
  rows: BlockRow[];
  rooms: { id: string; name: string }[];
  today: string;
  /** MI301 / MI302: what was just done */
  notice?: string | null;
  /** MW301, MW302: what the block just set touches (it is saved all the same) */
  overlaps?: { reservations: number; lessons: number } | null;
}) {
  return (
    <>
      <PageHeading
        title="使用止め"
        description="教室を、日付と時限の範囲で予約できなくします。どの先生でも設定・解除できます。"
      />
      {notice && (
        <Callout icon="check" className="mb-3" key={notice}>
          {notice}
        </Callout>
      )}
      {overlaps && overlaps.reservations > 0 && (
        <Callout kind="warning" icon="info" className="mb-3">
          {MESSAGES.MW301(overlaps.reservations)}
        </Callout>
      )}
      {overlaps && overlaps.lessons > 0 && (
        <Callout kind="warning" icon="info" className="mb-3">
          {MESSAGES.MW302(overlaps.lessons)}
        </Callout>
      )}

      <Card className="mb-2 p-5 sm:p-6">
        <h2 className="mb-4 text-base font-bold">追加</h2>
        <BlockForm rooms={rooms} today={today} />
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
                  {row.overlapReservations > 0 ? (
                    <LinkButton
                      size="sm"
                      href={withQuery("/teacher/reservations", {
                        block: row.id,
                      })}
                    >
                      承認済みの予約 {row.overlapReservations}件
                    </LinkButton>
                  ) : (
                    <>承認済みの予約 0件</>
                  )}{" "}
                  / 授業 {row.overlapLessons}件
                </Td>
                <Td>
                  <ReleaseBlockButton id={row.id} />
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
