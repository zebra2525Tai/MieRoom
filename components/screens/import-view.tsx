import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Badge,
  NotReadyNotice,
  PageHeading,
  SectionHead,
  TableWrap,
  Td,
  Th,
  type BadgeKind,
} from "@/components/ui/parts";
import type { MonthWindow } from "@/lib/domain/import-window";
import { formatMonth } from "@/lib/domain/school-date";

export type ImportCell = {
  /** 未取込 until something was imported. null: the class does not exist that month. */
  imported: "none" | "provisional" | "done" | null;
  importedText?: string;
  /** システムで変更した授業の件数 (R3-12) */
  changedLessons?: number;
};

export type ImportRow = {
  id: string;
  name: string;
  cells: [ImportCell, ImportCell];
};

const WINDOW: Record<MonthWindow, { label: string; kind: BadgeKind }> = {
  past: { label: "過ぎた月", kind: "neutral" },
  open: { label: "受付中", kind: "available" },
  closed: { label: "締め済み", kind: "error" },
  "not-yet": { label: "4月1日から", kind: "neutral" },
};

const IMPORTED_LABEL = {
  none: "未取込",
  provisional: "仮の時間割だけ",
  done: "取込済み",
} as const;

function Steps() {
  return (
    <div className="mb-6 mt-2 flex max-w-[680px] items-center gap-3">
      {["ファイルを選ぶ", "確認する", "取り込む"].map((label, index) => (
        <div key={label} className="contents">
          {index > 0 && <div className="h-px min-w-6 flex-1 bg-[#dce5eb]" />}
          <div
            className={`flex items-center gap-2 text-xs ${index === 0 ? "font-bold text-teal-dark" : "text-[#91a0ac]"}`}
          >
            <span
              className={`grid h-[27px] w-[27px] place-items-center rounded-full text-[11px] font-bold ${
                index === 0 ? "bg-[#dfefe8] text-teal-dark" : "bg-[#e8edf1]"
              }`}
            >
              {index + 1}
            </span>
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

// S20 時間割の取り込み
export function ImportView({
  months,
  windows,
  rows,
}: {
  /** The two columns: this month and next month. */
  months: [string, string];
  windows: [MonthWindow, MonthWindow];
  rows: ImportRow[];
}) {
  return (
    <>
      <PageHeading
        title="時間割の取り込み"
        description="担任が作った取込用CSVを、まとめて確かめてから取り込みます。"
      />
      <NotReadyNotice>
        画面の形を確かめる段階です。授業の表ができてから、取り込めるようになります。
      </NotReadyNotice>
      <Steps />

      <div className="rounded-xl border-[1.5px] border-dashed border-[#c6d5df] bg-[#fbfcfd] px-6 py-10 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-[14px] bg-[#eaf2f7] text-[#6993aa]">
          <Icon name="upload" size={27} />
        </div>
        <h2 className="text-[17px] font-bold">取込用CSVを選ぶ</h2>
        <p className="mb-4 mt-2 text-xs text-muted">
          複数まとめて選べます(1回50ファイル、1ファイル1MB、合計4MBまで)。
          <br />
          エラーが1つでもあると、何も取り込みません。
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <input
            type="file"
            accept=".csv"
            multiple
            aria-label="取込用CSV"
            className="max-w-full text-xs"
          />
          <Button variant="primary" disabled>
            確認する
            <Icon name="arrow" size={15} />
          </Button>
        </div>
      </div>

      <SectionHead
        title="取り込みの状況"
        description="その月の年度に存在する、有効なクラス。26日の0時に、その月のファイルを締めます。"
      />
      <TableWrap>
        <thead>
          <tr>
            <Th>クラス</Th>
            {months.map((month, index) => (
              <Th key={month}>
                {formatMonth(month)}
                <span className="ml-2 inline-block align-middle">
                  <Badge kind={WINDOW[windows[index]].kind}>
                    {WINDOW[windows[index]].label}
                  </Badge>
                </span>
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td>
                <strong>{row.name}</strong>
              </Td>
              {row.cells.map((cell, index) => (
                <Td key={months[index]}>
                  {cell.imported === null ? (
                    <span className="text-muted">—</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        kind={
                          cell.imported === "done" ? "available" : "warning"
                        }
                      >
                        {IMPORTED_LABEL[cell.imported]}
                      </Badge>
                      {cell.importedText && (
                        <span className="text-[11px] text-muted">
                          {cell.importedText}
                        </span>
                      )}
                      {cell.changedLessons !== undefined &&
                        cell.changedLessons > 0 && (
                          <Badge kind="busy">
                            システムで変更あり({cell.changedLessons}件)
                          </Badge>
                        )}
                      {index === 0 && windows[0] === "closed" && (
                        <Button size="sm" disabled>
                          例外解除
                        </Button>
                      )}
                    </div>
                  )}
                </Td>
              ))}
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  );
}
