import {
  Badge,
  PageHeading,
  SectionHead,
  TableWrap,
  Td,
  Th,
  type BadgeKind,
} from "@/components/ui/parts";
import type { MonthWindow } from "@/lib/domain/import-window";
import { formatMonth } from "@/lib/domain/school-date";
import { ImportPanel, UnlockButton } from "./import-panel";

export type ImportCell = {
  /** 未取込 until something was imported. null: the class does not exist that month. */
  imported: "none" | "provisional" | "done" | null;
  importedText?: string;
  /** システムで変更した授業の件数 (R3-12) */
  changedLessons?: number;
  /** 例外解除中 (R3-5) */
  unlocked?: boolean;
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
      <ImportPanel />

      <SectionHead
        title="取り込みの状況"
        description="その月の年度に存在する、有効なクラス。26日の0時に、その月のファイルを締めます。"
      />
      <TableWrap>
        <thead>
          <tr>
            {/* 2つの月の列を同じ幅にする(中身の量で幅が変わらない) */}
            <Th className="sm:w-[240px]">クラス</Th>
            {months.map((month, index) => (
              <Th key={month} className="w-[38%]">
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
                      {cell.unlocked && (
                        <Badge kind="warning">例外解除中</Badge>
                      )}
                      {index === 0 &&
                        windows[0] === "closed" &&
                        !cell.unlocked && (
                          <UnlockButton
                            classId={row.id}
                            className={row.name}
                            month={months[0]}
                          />
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
