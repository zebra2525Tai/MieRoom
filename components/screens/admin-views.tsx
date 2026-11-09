import Form from "next/form";
import Link from "next/link";
import { AutoSubmitSelect } from "@/components/ui/auto-submit";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Badge,
  Callout,
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
} from "@/components/ui/parts";
import type { ExportIssue } from "@/lib/domain/master-export";
import {
  LinkAddButton,
  LinkRemoveButton,
  type LinkChoices,
} from "./link-editor";
import { ClosureDeleteButton, ClosureEditButton } from "./closure-editor";
import { DeleteButton } from "./delete-button";
import { MasterActiveButton, MasterEditButton } from "./master-editor";
import {
  ReceiverAddForm,
  ReceiverRemoveButton,
  TagEditor,
} from "./access-editors";
import type { RoomKind } from "@/lib/domain/room-status";
import { MESSAGES } from "@/lib/messages";
import { withQuery } from "@/lib/url";
import { KIND_LABEL } from "./rooms-view";

// 時間割管理者の画面 (外部設計書 06-3).

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
        homeRoomId: string;
        startYear: number;
        endYear: number | null;
        active: boolean;
        version: string;
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
        version: string;
      }[];
    }
  | {
      tab: "subjects";
      rows: { id: string; name: string; active: boolean; version: string }[];
    }
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
        version: string;
      }[];
    };

// S21 マスタ
export function MastersView({
  data,
  showInactive,
  basePath = "/admin/masters",
  rooms = [],
  defaultYear,
  notice,
  renamed = false,
  fixCount = 0,
}: {
  data: MasterData;
  showInactive: boolean;
  /** Where the tabs live: `${basePath}/${tab}`. */
  basePath?: string;
  /** Active rooms, for the 教室 box of a class */
  rooms?: { id: string; name: string }[];
  /** 開始年度の初期値: this school year */
  defaultYear: number;
  /** MI501 / MI502: what was just done */
  notice?: string | null;
  /** MW501: a name was changed */
  renamed?: boolean;
  /** MW502: how many things the CSV export check wants fixed */
  fixCount?: number;
}) {
  const path = `${basePath}/${data.tab}`;
  return (
    <>
      <PageHeading
        title="マスタ"
        actions={
          <MasterEditButton
            tab={data.tab}
            row={null}
            rooms={rooms}
            defaultYear={defaultYear}
            variant="primary"
          >
            <Icon name="plus" size={16} />
            追加
          </MasterEditButton>
        }
      />
      {notice && (
        <Callout icon="check" className="mb-3" key={notice}>
          {notice}
        </Callout>
      )}
      {renamed && (
        <Callout kind="warning" icon="info" className="mb-3">
          {MESSAGES.MW501}
        </Callout>
      )}
      {fixCount > 0 && (
        <Callout kind="warning" icon="info" className="mb-3">
          {MESSAGES.MW502(fixCount)}
        </Callout>
      )}
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
        <span className="text-[11px] text-muted sm:ml-auto">
          {data.rows.length}件
        </span>
      </FilterBar>
      {data.rows.length === 0 ? (
        <EmptyState title="登録がありません" />
      ) : (
        <TableWrap>
          {data.tab === "classes" && (
            <>
              <thead>
                <tr>
                  <Th>クラス名</Th>
                  <Th>ホームルーム教室</Th>
                  <Th>開始年度</Th>
                  <Th>終了年度</Th>
                  <Th>状態</Th>
                  <Th>操作</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <strong>{row.name}</strong>
                    </Td>
                    <Td>{row.homeRoom}</Td>
                    <Td>{row.startYear}</Td>
                    <Td>{row.endYear ?? "(続く)"}</Td>
                    <Td>
                      <ActiveBadge active={row.active} />
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        <MasterEditButton
                          tab={data.tab}
                          row={{
                            id: row.id,
                            version: row.version,
                            name: row.name,
                            homeRoomId: row.homeRoomId,
                            startYear: row.startYear,
                            endYear: row.endYear,
                          }}
                          rooms={rooms}
                          defaultYear={defaultYear}
                        >
                          編集
                        </MasterEditButton>
                        <MasterActiveButton
                          tab={data.tab}
                          id={row.id}
                          name={row.name}
                          active={row.active}
                        />
                      </div>
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
                  <Th>状態</Th>
                  <Th>操作</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <strong>{row.name}</strong>
                    </Td>
                    <Td>{row.email ?? "—"}</Td>
                    <Td>{row.tagId ?? "—"}</Td>
                    <Td>
                      <ActiveBadge active={row.active} />
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        <MasterEditButton
                          tab={data.tab}
                          row={{
                            id: row.id,
                            version: row.version,
                            name: row.name,
                            email: row.email,
                          }}
                          rooms={rooms}
                          defaultYear={defaultYear}
                        >
                          編集
                        </MasterEditButton>
                        <MasterActiveButton
                          tab={data.tab}
                          id={row.id}
                          name={row.name}
                          active={row.active}
                        />
                      </div>
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
                  <Th>状態</Th>
                  <Th>操作</Th>
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
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        <MasterEditButton
                          tab={data.tab}
                          row={{
                            id: row.id,
                            version: row.version,
                            name: row.name,
                          }}
                          rooms={rooms}
                          defaultYear={defaultYear}
                        >
                          編集
                        </MasterEditButton>
                        <MasterActiveButton
                          tab={data.tab}
                          id={row.id}
                          name={row.name}
                          active={row.active}
                        />
                      </div>
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
                  <Th>棟・階</Th>
                  <Th>分類</Th>
                  <Th>備考</Th>
                  <Th>受信機ID</Th>
                  <Th>状態</Th>
                  <Th>操作</Th>
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
                    <Td>{row.note ?? "—"}</Td>
                    <Td>{row.receivers.join("、") || "—"}</Td>
                    <Td>
                      <ActiveBadge active={row.active} />
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        <MasterEditButton
                          tab={data.tab}
                          row={{
                            id: row.id,
                            version: row.version,
                            name: row.name,
                            building: row.building,
                            kind: row.kind,
                            note: row.note,
                          }}
                          rooms={rooms}
                          defaultYear={defaultYear}
                        >
                          編集
                        </MasterEditButton>
                        <MasterActiveButton
                          tab={data.tab}
                          id={row.id}
                          name={row.name}
                          active={row.active}
                        />
                      </div>
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
  choices,
  basePath = "/admin/links",
  notice,
  fixCount = 0,
}: {
  tab: LinkTab;
  classes: { id: string; name: string }[];
  classId: string | null;
  /** subject, and the teacher or room of that row (empty for クラスの教科). */
  rows: {
    key: string;
    subjectId: string;
    targetKey: string;
    subject: string;
    value: string;
    missing?: boolean;
  }[];
  /** The lists of the 追加 box */
  choices: LinkChoices;
  basePath?: string;
  /** MI501: what was just done */
  notice?: string | null;
  /** MW502: how many things the CSV export check wants fixed */
  fixCount?: number;
}) {
  return (
    <>
      <PageHeading
        title="紐づけ"
        actions={
          classId ? (
            <LinkAddButton tab={tab} classId={classId} choices={choices} />
          ) : undefined
        }
      />
      {notice && (
        <Callout icon="check" className="mb-3" key={notice}>
          {notice}
        </Callout>
      )}
      {fixCount > 0 && (
        <Callout kind="warning" icon="info" className="mb-3">
          {MESSAGES.MW502(fixCount)}
        </Callout>
      )}
      <Tabs
        label="紐づけの種類"
        items={LINK_TABS.map((item) => ({
          label: item.label,
          href: withQuery(basePath, { tab: item.tab, class: classId }),
          active: tab === item.tab,
        }))}
      />
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
        <span className="text-[11px] text-muted sm:ml-auto">
          {rows.length}件
        </span>
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState title="登録がありません" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>教科</Th>
              {tab !== "subjects" && (
                <Th>{tab === "teachers" ? "講師" : "教室"}</Th>
              )}
              {tab === "subjects" && <Th>確認</Th>}
              <Th>操作</Th>
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
                <Td>
                  {classId && (
                    <LinkRemoveButton
                      tab={tab}
                      classId={classId}
                      subjectId={row.subjectId}
                      targetKey={row.targetKey}
                    />
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

export type ClosureRow = {
  id: string;
  /** Made in the system: can be changed and deleted. The rows of the tool cannot. */
  editable: boolean;
  startDate: string;
  endDate: string | null;
  classId: string | null;
  version: string;
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
  classes,
  basePath = "/admin/closures",
  notice,
  fixCount = 0,
}: {
  year: number;
  years: number[];
  rows: ClosureRow[];
  hasSchoolClosure: boolean;
  /** The classes of this school year, for 対象クラス */
  classes: { id: string; name: string }[];
  basePath?: string;
  /** MI501: what was just done */
  notice?: string | null;
  /** MW502: how many things the CSV export check wants fixed */
  fixCount?: number;
}) {
  return (
    <>
      <PageHeading
        title="休み・行事"
        actions={
          <ClosureEditButton row={null} classes={classes} variant="primary">
            <Icon name="plus" size={16} />
            追加
          </ClosureEditButton>
        }
      />
      {notice && (
        <Callout icon="check" className="mb-3" key={notice}>
          {notice}
        </Callout>
      )}
      {fixCount > 0 && (
        <Callout kind="warning" icon="info" className="mb-3">
          {MESSAGES.MW502(fixCount)}
        </Callout>
      )}
      <Callout kind="warning">
        全校の休み・行事の日は、営業日から外れます(行事の日も含みます。予約の締め切りに使います)。
      </Callout>
      {!hasSchoolClosure && (
        <Callout kind="warning">{MESSAGES.MW504(year)}</Callout>
      )}
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
        <span className="text-[11px] text-muted sm:ml-auto">
          {rows.length}件
        </span>
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState title="この年度の休み・行事はありません" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>開始日</Th>
              <Th>終了日</Th>
              <Th>名称</Th>
              <Th>対象クラス</Th>
              <Th>出どころ</Th>
              <Th>操作</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <Td>{row.startText}</Td>
                <Td>{row.endText}</Td>
                <Td>
                  <strong>{row.name}</strong>
                </Td>
                <Td>{row.target}</Td>
                <Td>{row.source}</Td>
                <Td>
                  {row.editable ? (
                    <div className="flex flex-wrap gap-2">
                      <ClosureEditButton row={row} classes={classes}>
                        編集
                      </ClosureEditButton>
                      <ClosureDeleteButton id={row.id} name={row.name} />
                    </div>
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
        <Callout kind="info">
          書き出し前の確認: 直す必要があるものはありません。
        </Callout>
      )}
      {issues.length > 0 && (
        <div className="mb-6">
          <TableWrap>
            <thead>
              <tr>
                <Th>区分</Th>
                <Th>確認</Th>
                <Th>内容</Th>
                <Th>対象</Th>
                <Th>直す画面</Th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue, index) => (
                <tr key={index}>
                  <Td>
                    <Badge kind={issue.level === "error" ? "error" : "warning"}>
                      {issue.level === "error" ? "エラー" : "警告"}
                    </Badge>
                  </Td>
                  <Td>
                    {issue.check === null ? "—" : `R5-6 の${issue.check}`}
                  </Td>
                  <Td className="min-w-[280px] whitespace-normal">
                    {issue.message}
                  </Td>
                  <Td className="whitespace-normal">{issue.target}</Td>
                  <Td>
                    {issue.fixPath !== "" && (
                      <Link
                        href={issue.fixPath}
                        className="font-semibold text-brand-dark underline"
                      >
                        直す
                      </Link>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
      )}
      <SectionHead
        title="書き出すファイル"
        description="エラーがなければ、この8つがZIPに入ります。"
      />
      <TableWrap>
        <thead>
          <tr>
            <Th>ファイル</Th>
            <Th>行数</Th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.name}>
              <Td>{file.name}</Td>
              <Td>{file.rows}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <form
        method="post"
        action="/admin/export/download"
        className="mt-5 flex flex-wrap items-center gap-3"
      >
        <Button type="submit" variant="primary" disabled={errorCount > 0}>
          <Icon name="download" size={16} />
          8つのCSVを書き出す
        </Button>
        <span className="text-[11px] text-muted">
          書き出したら、全担任に配ってください。
        </span>
      </form>
    </>
  );
}

// S25 タグ・受信機
export function AccessView({
  teachers,
  receivers,
  rooms,
  notice,
}: {
  teachers: {
    id: string;
    name: string;
    tagId: string | null;
    active: boolean;
  }[];
  receivers: { id: string; receiverId: string; room: string }[];
  rooms: { id: string; name: string }[];
  /** MI501: what was just done */
  notice?: string | null;
}) {
  return (
    <>
      <PageHeading title="タグ・受信機" />
      {notice && (
        <Callout icon="check" className="mb-5" key={notice}>
          {notice}
        </Callout>
      )}
      <SectionHead
        title="受信機"
        description="ゲートウェイが送る教室ID(roomId)を、教室に登録します。1つの受信機は1つの教室。1つの教室に複数置けます。登録のないIDは、位置に反映されません。"
      />
      <ReceiverAddForm rooms={rooms} />
      {receivers.length === 0 ? (
        <EmptyState title="受信機は登録されていません" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>受信機ID</Th>
              <Th>教室</Th>
              <Th>操作</Th>
            </tr>
          </thead>
          <tbody>
            {receivers.map((row) => (
              <tr key={row.id}>
                <Td>
                  <strong>{row.receiverId}</strong>
                </Td>
                <Td>{row.room}</Td>
                <Td>
                  <ReceiverRemoveButton id={row.id} />
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      <SectionHead
        title="タグ"
        description="ビーコンの minor(0〜65535の数字)を登録します。登録のない講師は「位置情報なし」と出ます。変えたり外したりすると、その講師のいまの位置は消えます。"
      />
      <TableWrap>
        <thead>
          <tr>
            <Th>講師</Th>
            <Th>タグID</Th>
          </tr>
        </thead>
        <tbody>
          {teachers.map((row) => (
            <tr key={row.id}>
              <Td>
                <strong>{row.name}</strong>
                {!row.active && <SubText>無効</SubText>}
              </Td>
              <Td>
                {row.active ? (
                  <TagEditor teacherId={row.id} tagId={row.tagId} />
                ) : (
                  (row.tagId ?? <span className="text-muted">—</span>)
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
export type DeleteRow = {
  id: string;
  name: string;
  canDelete: boolean;
  reasons: string[];
  impacts: string[];
};

const DELETE_TABS: { tab: MasterTab; label: string }[] = MASTER_TABS;

export function DeleteView({
  tab,
  rows,
  notice,
  basePath = "/admin/delete",
}: {
  tab: MasterTab;
  rows: DeleteRow[];
  /** MI503: what was just done */
  notice?: string | null;
  basePath?: string;
}) {
  return (
    <>
      <PageHeading title="削除管理" />
      {notice && (
        <Callout icon="check" className="mb-3" key={notice}>
          {notice}
        </Callout>
      )}
      <Tabs
        label="削除するものの種類"
        items={DELETE_TABS.map((item) => ({
          label: item.label,
          href: withQuery(basePath, { tab: item.tab }),
          active: tab === item.tab,
        }))}
      />
      {rows.length === 0 ? (
        <EmptyState title="無効にしたものは、ありません">
          削除するには、先に「マスタ」で無効にしてください。
        </EmptyState>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>名前</Th>
              <Th>削除できるか</Th>
              <Th>使われている理由</Th>
              <Th>削除したときの影響</Th>
              <Th>操作</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <Td>
                  <strong>{row.name}</strong>
                </Td>
                <Td>
                  <Badge kind={row.canDelete ? "available" : "neutral"}>
                    {row.canDelete ? "できる" : "できない"}
                  </Badge>
                </Td>
                <Td className="whitespace-normal">
                  {row.reasons.length > 0 ? (
                    row.reasons.join("、")
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </Td>
                <Td className="whitespace-normal">
                  {row.impacts.join("。") || "—"}
                </Td>
                <Td>
                  {row.canDelete ? (
                    <DeleteButton
                      kind={tab}
                      id={row.id}
                      name={row.name}
                      impacts={row.impacts}
                    />
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
      <EmptyState title="モニターURLはありません">
        URLは、この画面でだけ見られます。合言葉を変えると、古いURLはすぐに使えなくなります。
      </EmptyState>
    </>
  );
}
