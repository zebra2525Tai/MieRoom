import Form from "next/form";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Badge,
  Card,
  EmptyState,
  FilterBar,
  Footnote,
  PageHeading,
} from "@/components/ui/parts";

// 先生の位置の 3 つの状態 (外部設計書 R7-2).
export type TeacherLocation =
  { kind: "room"; room: string } | { kind: "out-of-area" } | { kind: "no-tag" };

export type TeacherRow = {
  id: string;
  name: string;
  location: TeacherLocation;
  /** 担当: クラス・教科と、その教室 (教室未定は 各教室) */
  assignments: { className: string; subject: string; rooms: string[] }[];
};

function LocationBox({ location }: { location: TeacherLocation }) {
  const title =
    location.kind === "room"
      ? location.room
      : location.kind === "out-of-area"
        ? "検知エリア外"
        : "位置情報なし";
  const note =
    location.kind === "room"
      ? "いま検知されている教室です"
      : location.kind === "out-of-area"
        ? "受信機に検知されていません(校外という意味ではありません)"
        : "タグが登録されていません";
  return (
    <div className="flex items-center justify-between gap-2.5 rounded-[9px] bg-[#f6f9fb] p-3.5">
      <div className="min-w-0">
        <strong className="text-[19px] text-navy">{title}</strong>
        <p className="mt-0.5 text-[11px] text-[#8494a1]">{note}</p>
      </div>
      <Icon
        name={location.kind === "room" ? "pin" : "info"}
        size={23}
        className="text-[#8aa5b3]"
      />
    </div>
  );
}

// S05 先生一覧
export function TeachersView({
  teachers,
  query,
  basePath = "/teachers",
}: {
  teachers: TeacherRow[];
  query: string;
  basePath?: string;
}) {
  return (
    <>
      <PageHeading
        title="先生一覧"
        description="先生のいまの位置と、担当の教科・教室を確認できます。"
      />
      <FilterBar>
        <Form action={basePath} className="flex w-full items-center gap-2">
          <div className="relative w-full max-w-[310px]">
            <Icon
              name="search"
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#91a1ad]"
            />
            <input
              key={query}
              name="q"
              defaultValue={query}
              aria-label="名前で絞る"
              placeholder="名前で絞る"
              className="h-[38px] w-full rounded-lg border border-line bg-[#fbfcfd] pl-9 pr-3 text-xs"
            />
          </div>
          <Button type="submit" size="sm" className="h-[38px]">
            絞り込む
          </Button>
        </Form>
      </FilterBar>
      <div className="my-3 text-xs text-muted">{teachers.length}人を表示</div>
      {teachers.length === 0 ? (
        <EmptyState title="先生が見つかりません">
          名前の条件を変えてください。
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {teachers.map((teacher) => (
            <Card key={teacher.id} className="flex flex-col gap-4 p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-[43px] w-[43px] shrink-0 place-items-center rounded-xl bg-[#e9eef6] text-[15px] font-bold text-navy">
                  {teacher.name[0]}
                </div>
                <div className="text-base font-bold">{teacher.name}</div>
                {teacher.location.kind === "room" && (
                  <div className="ml-auto">
                    <Badge kind="available">検知中</Badge>
                  </div>
                )}
              </div>
              <LocationBox location={teacher.location} />
              {teacher.assignments.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer font-semibold text-teal-dark">
                    担当({teacher.assignments.length})
                  </summary>
                  <ul className="mt-2 flex flex-col gap-1 text-muted">
                    {teacher.assignments.map((item) => (
                      <li key={`${item.className}/${item.subject}`}>
                        <span className="text-ink">{item.className}</span>{" "}
                        {item.subject}
                        <span className="ml-1.5">
                          ({item.rooms.join("、") || "各教室"})
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Card>
          ))}
        </div>
      )}
      <Footnote>
        位置は受信機の検知に基づきます。相談できるかどうかを示すものではありません。
      </Footnote>
    </>
  );
}
