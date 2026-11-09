import Form from "next/form";
import { AutoSubmitSelect } from "@/components/ui/auto-submit";
import { Button, LinkButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Badge,
  Callout,
  Card,
  EmptyState,
  FilterBar,
  NotReadyNotice,
  PageHeading,
  SectionHead,
  Segmented,
  SubText,
  Tabs,
  TableWrap,
  Td,
  Th,
  monoTextClass,
} from "@/components/ui/parts";
import type { ExportIssue } from "@/lib/domain/master-export";
import type { RoomKind } from "@/lib/domain/room-status";
import { MESSAGES } from "@/lib/messages";
import { withQuery } from "@/lib/url";
import { KIND_LABEL } from "./rooms-view";

// 時間割管理者の画面 (外部設計書 06-3). Looks only.

const READ_ONLY_NOTE =
  "一覧は実際のデータです。追加・編集は、これから作ります。";

// Fixed widths for the short columns of S21 (from lg, where every column fits), so that
// 状態 and the other short columns stay in the same place when the tab changes. The
// name and note columns take the rest. Below lg the table keeps its natural widths and
// scrolls sideways (with the edge shadow of TableWrap). Not from md: at 768 the クラス and
// 教室 tables are wider than the box, so the fixed widths cannot hold there and 状態
// would move further between tabs than with natural widths.
const COL = {
  status: "lg:w-24",
  year: "lg:w-28",
  short: "lg:w-28",
  id: "lg:w-32",
} as const;

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge kind={active ? "available" : "neutral"}>
      {active ? "有効" : "無効"}
    </Badge>
  );
}

export type MasterTab = "classes" | "teachers" | "subjects" | "rooms";

const MASTER_TABS: { tab: MasterTab; label: string }[] = [
  { tab: "classes", label: "クラス" },
  { tab: "teachers", label: "講師" },
  { tab: "subjects", label: "教科" },
  { tab: "rooms", label: "教室" },
];

export type MasterData =
  | {
      tab: "classes";
      rows: {
        id: string;
        name: string;
        homeRoom: string;
        startYear: number;
        endYear: number | null;
        active: boolean;
      }[];
    }
  | {
      tab: "teachers";
      rows: {
        id: string;
        name: string;
        email: string | null;
        tagId: string | null;
        active: boolean;
      }[];
    }
  | { tab: "subjects"; rows: { id: string; name: string; active: boolean }[] }
  | {
      tab: "rooms";
      rows: {
        id: string;
        name: string;
        building: string | null;
        kind: RoomKind;
        note: string | null;
        receivers: string[];
        active: boolean;
      }[];
    };

// S21 マスタ
export function MastersView({
  data,
  showInactive,
  basePath = "/admin/masters",
}: {
  data: MasterData;
  showInactive: boolean;
  /** Where the tabs live: `${basePath}/${tab}`. */
  basePath?: string;
}) {
  const path = `${basePath}/${data.tab}`;
  return (
    <>
      <PageHeading
        title="マスタ"
        actions={
          <Button variant="primary" disabled>
            <Icon name="plus" size={16} />
            追加
          </Button>
        }
      />
      <Callout kind="neutral">{READ_ONLY_NOTE}</Callout>
      <Tabs
        label="マスタの種類"
        items={MASTER_TABS.map((item) => ({
          label: item.label,
          href: `${basePath}/${item.tab}`,
          active: data.tab === item.tab,
        }))}
      />
      <FilterBar>
        <Segmented
          label="無効なものも表示するか"
          items={[
            { label: "有効だけ", href: path, active: !showInactive },
            {
              label: "無効も表示",
              href: withQuery(path, { inactive: 1 }),
              active: showInactive,
            },
          ]}
        />
        <span className="ml-auto whitespace-nowrap text-[11px] text-muted tabular-nums">
          {data.rows.length}件
        </span>
      </FilterBar>
      {data.rows.length === 0 ? (
        <EmptyState icon="info" title="登録がありません" />
      ) : (
        <TableWrap>
          {data.tab === "classes" && (
            <>
              <thead>
                <tr>
                  <Th>クラス名</Th>
                  <Th>ホームルーム教室</Th>
                  <Th numeric className={COL.year}>
                    開始年度
                  </Th>
                  <Th numeric className={COL.year}>
                    終了年度
                  </Th>
                  <Th className={COL.status}>状態</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <strong>{row.name}</strong>
                    </Td>
                    <Td>{row.homeRoom}</Td>
                    <Td numeric>{row.startYear}</Td>
                    <Td numeric>{row.endYear ?? "(続く)"}</Td>
                    <Td>
                      <ActiveBadge active={row.active} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
          {data.tab === "teachers" && (
            <>
              <thead>
                <tr>
                  <Th>時間割での表記</Th>
                  <Th>メール</Th>
                  <Th>タグID</Th>
                  <Th className={COL.status}>状態</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <strong>{row.name}</strong>
                    </Td>
                    <Td>{row.email ?? "—"}</Td>
                    <Td>
                      {row.tagId === null ? (
                        "—"
                      ) : (
                        <span className={monoTextClass}>{row.tagId}</span>
                      )}
                    </Td>
                    <Td>
                      <ActiveBadge active={row.active} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
          {data.tab === "subjects" && (
            <>
              <thead>
                <tr>
                  <Th>教科名</Th>
                  <Th className={COL.status}>状態</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <strong>{row.name}</strong>
                    </Td>
                    <Td>
                      <ActiveBadge active={row.active} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
          {data.tab === "rooms" && (
            <>
              <thead>
                <tr>
                  <Th>教室名</Th>
                  <Th className={COL.short}>棟・階</Th>
                  <Th className={COL.short}>分類</Th>
                  <Th>備考</Th>
                  <Th className={COL.id}>受信機ID</Th>
                  <Th className={COL.status}>状態</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <strong>{row.name}</strong>
                    </Td>
                    <Td>{row.building ?? "—"}</Td>
                    <Td>{KIND_LABEL[row.kind]}</Td>
                    {/* min-w-28 below lg keeps the six columns inside a 512px box (tablet
                        with the sidebar). */}
                    <Td className="min-w-28 whitespace-normal lg:min-w-40">
                      {row.note ?? "—"}
                    </Td>
                    <Td>
                      {row.receivers.length === 0 ? (
                        "—"
                      ) : (
                        <span className={monoTextClass}>
                          {row.receivers.join("、")}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <ActiveBadge active={row.active} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </TableWrap>
      )}
    </>
  );
}

export type LinkTab = "subjects" | "teachers" | "rooms";

const LINK_TABS: { tab: LinkTab; label: string }[] = [
  { tab: "subjects", label: "クラスの教科" },
  { tab: "teachers", label: "教科の講師" },
  { tab: "rooms", label: "教科の教室" },
];

// S22 紐づけ
export function LinksView({
  tab,
  classes,
  classId,
  rows,
  basePath = "/admin/links",
}: {
  tab: LinkTab;
  classes: { id: string; name: string }[];
  classId: string | null;
  /** subject, and the teacher or room of that row (empty for クラスの教科). */
  rows: { key: string; subject: string; value: string; missing?: boolean }[];
  basePath?: string;
}) {
  return (
    <>
      <PageHeading
        title="紐づけ"
        actions={
          <Button variant="primary" disabled>
            <Icon name="plus" size={16} />
            追加
          </Button>
        }
      />
      <Callout kind="neutral">{READ_ONLY_NOTE}</Callout>
      <Tabs
        label="紐づけの種類"
        items={LINK_TABS.map((item) => ({
          label: item.label,
          href: withQuery(basePath, { tab: item.tab, class: classId }),
          active: tab === item.tab,
        }))}
      />
      {/* The bar, its count and the table share one right edge (max-w-3xl). */}
      <div className="max-w-3xl">
        <FilterBar>
          <Form action={basePath} className="flex items-center gap-2.5">
            <input type="hidden" name="tab" value={tab} />
            <AutoSubmitSelect
              key={classId ?? "none"}
              name="class"
              defaultValue={classId ?? ""}
              aria-label="クラス"
            >
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </AutoSubmitSelect>
            <noscript>
              <button type="submit">表示</button>
            </noscript>
          </Form>
          <span className="ml-auto whitespace-nowrap text-[11px] text-muted tabular-nums">
            {rows.length}件
          </span>
        </FilterBar>
        {rows.length === 0 ? (
          <EmptyState icon="info" title="登録がありません" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th className="w-[45%]">教科</Th>
                {tab !== "subjects" && (
                  <Th>{tab === "teachers" ? "講師" : "教室"}</Th>
                )}
                {tab === "subjects" && <Th>確認</Th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <Td>
                    <strong>{row.subject}</strong>
                  </Td>
                  {tab !== "subjects" && <Td>{row.value}</Td>}
                  {tab === "subjects" && (
                    <Td>
                      {row.missing ? (
                        <Badge kind="error">講師の行がありません</Badge>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </div>
    </>
  );
}

export type ClosureRow = {
  id: string;
  startText: string;
  endText: string;
  name: string;
  target: string;
  source: string;
};

// S23 休み・行事
export function ClosuresView({
  year,
  years,
  rows,
  hasSchoolClosure,
  basePath = "/admin/closures",
}: {
  year: number;
  years: number[];
  rows: ClosureRow[];
  hasSchoolClosure: boolean;
  basePath?: string;
}) {
  return (
    <>
      <PageHeading
        title="休み・行事"
        actions={
          <Button variant="primary" disabled>
            <Icon name="plus" size={16} />
            追加
          </Button>
        }
      />
      <Callout kind="neutral">{READ_ONLY_NOTE}</Callout>
      <Callout kind="warning">
        全校の休み・行事の日は、営業日から外れます(行事の日も含みます。予約の締め切りに使います)。
      </Callout>
      {!hasSchoolClosure && (
        <Callout kind="warning">{MESSAGES.MW504(year)}</Callout>
      )}
      {/* The bar, its count and the table take the full width, the same as the
          callouts above, so every right edge lines up. A cap such as max-w-5xl left
          them just short of the callouts on a laptop (48px at 1366), which looked
          like a mistake. */}
      <div>
        <FilterBar>
          <Form action={basePath} className="flex items-center gap-2.5">
            <AutoSubmitSelect
              key={year}
              name="year"
              defaultValue={year}
              aria-label="年度"
            >
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}年度
                </option>
              ))}
            </AutoSubmitSelect>
            <noscript>
              <button type="submit">表示</button>
            </noscript>
          </Form>
          <span className="ml-auto whitespace-nowrap text-[11px] text-muted tabular-nums">
            {rows.length}件
          </span>
        </FilterBar>
        {rows.length === 0 ? (
          <EmptyState icon="info" title="この年度の休み・行事はありません" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>期間</Th>
                <Th>名称</Th>
                <Th>対象クラス</Th>
                <Th>出どころ</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {/* One line when there is room; otherwise the end date moves to a
                      second line together with its 〜 (never a 〜 alone at a line end). */}
                  <Td className="whitespace-normal">
                    <span className="whitespace-nowrap">{row.startText}</span>
                    {row.endText !== "—" && (
                      <>
                        <wbr />
                        <span className="whitespace-nowrap">
                          〜{row.endText}
                        </span>
                      </>
                    )}
                  </Td>
                  <Td className="min-w-28 whitespace-normal">
                    <strong>{row.name}</strong>
                  </Td>
                  <Td className="min-w-32 whitespace-normal">{row.target}</Td>
                  <Td className="min-w-36 whitespace-normal">{row.source}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </div>
    </>
  );
}

export type ExportFileRow = { name: string; rows: number };

// S24 CSV書き出し
export function ExportView({
  yearLabel,
  files,
  issues,
}: {
  yearLabel: string;
  files: ExportFileRow[];
  issues: ExportIssue[];
}) {
  const errorCount = issues.filter((issue) => issue.level === "error").length;
  return (
    <>
      <PageHeading title="CSV書き出し" />
      <Callout kind="neutral">
        範囲: {yearLabel}
        に存在する有効なクラス、有効なマスタ。休み・行事は今年度と翌4/1〜4/11。
      </Callout>
      {errorCount > 0 ? (
        <Callout kind="error">{MESSAGES.ME510(errorCount)}</Callout>
      ) : (
        <Callout kind="success" icon="check">
          書き出し前の確認: 直す必要があるものはありません。
        </Callout>
      )}
      {issues.length > 0 && (
        <div className="mb-5">
          {/* Below lg: one card per issue, so that 対象 and 直す are not squeezed or
              scrolled away. From lg: the table. */}
          <ul className="grid gap-3 lg:hidden">
            {issues.map((issue, index) => (
              <li key={index}>
                <Card className="flex flex-col gap-2 p-4 text-xs">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <IssueLevel issue={issue} />
                    {issue.check !== null && (
                      <span className="text-[11px] text-muted">
                        R5-6 の{issue.check}
                      </span>
                    )}
                  </div>
                  <p>{issue.message}</p>
                  {/* 対象 and 直す share a row (a footer under a line): no row holds
                      only the button. */}
                  <div className="mt-0.5 flex items-center justify-between gap-3 border-t border-line pt-2.5">
                    <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4">
                      <dt className="text-muted">対象</dt>
                      <dd className="min-w-0">{issue.target}</dd>
                    </dl>
                    {issue.fixPath !== "" && (
                      <IssueFixLink href={issue.fixPath} size="md" />
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          <div className="hidden lg:block">
            <TableWrap>
              <thead>
                <tr>
                  <Th>区分・確認</Th>
                  <Th>内容</Th>
                  <Th>対象</Th>
                  <Th>直す画面</Th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue, index) => (
                  <tr key={index}>
                    <Td>
                      <IssueLevel issue={issue} />
                      {issue.check !== null && (
                        <SubText>R5-6 の{issue.check}</SubText>
                      )}
                    </Td>
                    <Td className="min-w-64 whitespace-normal">
                      {issue.message}
                    </Td>
                    <Td className="min-w-40 whitespace-normal">
                      {issue.target}
                    </Td>
                    <Td>
                      {issue.fixPath !== "" && (
                        <IssueFixLink href={issue.fixPath} size="sm" />
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
        </div>
      )}
      {/* The page's only action comes before the file list, so that it is in view on a
          laptop screen. */}
      <form
        method="post"
        action="/admin/export/download"
        className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
      >
        <Button
          type="submit"
          variant="primary"
          disabled={errorCount > 0}
          className="w-full sm:w-auto"
        >
          <Icon name="download" size={16} />
          8つのCSVを書き出す
        </Button>
        <span className="text-[11px] text-muted">
          書き出したら、全担任に配ってください。
        </span>
      </form>
      <SectionHead
        title="書き出すファイル"
        description="エラーがなければ、この8つがZIPに入ります。"
      />
      <TableWrap className="max-w-3xl">
        <thead>
          <tr>
            <Th>ファイル</Th>
            <Th numeric className="w-24">
              行数
            </Th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.name}>
              <Td>{file.name}</Td>
              <Td numeric>{file.rows}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  );
}

function IssueLevel({ issue }: { issue: ExportIssue }) {
  return (
    <Badge kind={issue.level === "error" ? "error" : "warning"}>
      {issue.level === "error" ? "エラー" : "警告"}
    </Badge>
  );
}

/** sm in the lg table, md (full touch size) in the cards below lg. */
function IssueFixLink({ href, size }: { href: string; size: "sm" | "md" }) {
  return (
    <LinkButton size={size} href={href} className="shrink-0">
      直す
    </LinkButton>
  );
}

// S25 タグ・受信機
export function AccessView({
  teachers,
  receivers,
}: {
  teachers: { id: string; name: string; tagId: string | null }[];
  receivers: { id: string; receiverId: string; room: string }[];
}) {
  return (
    <>
      <PageHeading title="タグ・受信機" />
      <Callout kind="neutral">{READ_ONLY_NOTE}</Callout>
      <SectionHead
        title="受信機"
        description="1つの受信機は1つの教室。1つの教室に複数置けます。"
      />
      {receivers.length === 0 ? (
        <EmptyState icon="info" title="受信機は登録されていません" />
      ) : (
        <TableWrap className="max-w-3xl">
          <thead>
            <tr>
              <Th className="w-1/3">受信機ID</Th>
              <Th>教室</Th>
            </tr>
          </thead>
          <tbody>
            {receivers.map((row) => (
              <tr key={row.id}>
                <Td className="whitespace-normal">
                  <strong className={monoTextClass}>{row.receiverId}</strong>
                </Td>
                <Td>{row.room}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      <SectionHead
        title="タグ"
        description="タグが登録されていない講師は「位置情報なし」と出ます。"
      />
      <TableWrap className="max-w-3xl">
        <thead>
          <tr>
            <Th className="w-1/3">講師</Th>
            <Th>タグID</Th>
          </tr>
        </thead>
        <tbody>
          {teachers.map((row) => (
            <tr key={row.id}>
              <Td>
                <strong>{row.name}</strong>
              </Td>
              <Td className="whitespace-normal">
                {row.tagId === null ? (
                  <span className="text-muted">—</span>
                ) : (
                  <span className={monoTextClass}>{row.tagId}</span>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  );
}

// S26 削除管理
export function DeleteView() {
  return (
    <>
      <PageHeading title="削除管理" />
      <NotReadyNotice>
        画面の形を確かめる段階です。削除の判定は、授業・予約の表ができてから作ります。
      </NotReadyNotice>
      <EmptyState icon="trash" title="削除できるものを、ここに出します">
        名前、削除できるか、使われている理由、削除したときの影響を一覧にします。
      </EmptyState>
    </>
  );
}

// S27 モニターURL
export function MonitorsView() {
  return (
    <>
      <PageHeading
        title="モニターURL"
        actions={
          <Button variant="primary" disabled>
            <Icon name="plus" size={16} />
            追加
          </Button>
        }
      />
      <NotReadyNotice>
        画面の形を確かめる段階です。モニターの表ができてから、追加できるようになります。
      </NotReadyNotice>
      <EmptyState icon="monitor" title="モニターURLはありません">
        URLは、この画面でだけ見られます。合言葉を変えると、古いURLはすぐに使えなくなります。
      </EmptyState>
    </>
  );
}
