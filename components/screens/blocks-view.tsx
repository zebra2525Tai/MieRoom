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

function Overlap({ row }: { row: BlockRow }) {
  return (
    <>
      {row.overlapReservations > 0 ? (
        <LinkButton
          size="sm"
          href={withQuery("/teacher/reservations", { block: row.id })}
        >
          承認済みの予約 {row.overlapReservations}件
        </LinkButton>
      ) : (
        <>承認済みの予約 0件</>
      )}{" "}
      / 授業 {row.overlapLessons}件
    </>
  );
}

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
    <div className="max-w-4xl">
      <PageHeading title="使用止め" />
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

      {/* Same width as the other entry forms (S06/S12/S14); the heading and the list
          below share it, so the right edges line up. */}
      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-bold">追加</h2>
        <BlockForm rooms={rooms} today={today} />
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
                      <ReleaseBlockButton id={row.id} />
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
                    <ReleaseBlockButton id={row.id} />
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
