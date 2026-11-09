import Form from "next/form";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/ui/form";
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
  // Only a real room is loud (large navy on the brand tint). 検知エリア外 and
  // 位置情報なし are quieter, so they do not read like a place.
  const isRoom = location.kind === "room";
  return (
    <div
      className={`flex items-center justify-between gap-2.5 rounded-[9px] p-3.5 ${isRoom ? "bg-brand-tint" : "bg-[#f6f8fc]"}`}
    >
      <div className="min-w-0">
        <strong
          className={
            isRoom
              ? "text-[19px] text-navy"
              : "text-[15px] font-semibold text-[#4a576c]"
          }
        >
          {title}
        </strong>
        <p className="mt-0.5 text-[11px] text-[#586579]">{note}</p>
      </div>
      <Icon
        name={isRoom ? "pin" : "info"}
        size={23}
        className={isRoom ? "text-navy" : "text-[#586579]"}
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
      <PageHeading title="先生一覧" />
      <FilterBar>
        {/* The field takes the row and the button keeps its label on one line. */}
        <Form action={basePath} className="flex w-full items-center gap-2">
          <SearchField
            key={query}
            className="min-w-0 flex-1 sm:max-w-[310px]"
            name="q"
            defaultValue={query}
            aria-label="名前で絞る"
            placeholder="名前で絞る"
          />
          <Button type="submit" size="sm" className="h-[38px] shrink-0">
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
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {teachers.map((teacher) => (
            <Card key={teacher.id} className="flex flex-col gap-4 p-5">
              <div className="flex items-center gap-3">
                <div className="min-w-0 text-[17px] font-bold">
                  {teacher.name}
                </div>
                {teacher.location.kind === "room" && (
                  <div className="ml-auto">
                    <Badge kind="available">検知中</Badge>
                  </div>
                )}
              </div>
              <LocationBox location={teacher.location} />
              {teacher.assignments.length > 0 && (
                // mt-auto: 担当 sits at the bottom, at the same height in every card of a row.
                <details className="group mt-auto text-xs">
                  <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1.5 font-semibold text-brand-dark [&::-webkit-details-marker]:hidden">
                    <Icon
                      name="chevron"
                      size={14}
                      className="transition-transform group-open:rotate-90 motion-reduce:transition-none"
                    />
                    担当({teacher.assignments.length})
                  </summary>
                  <ul className="mt-1 flex flex-col gap-1 pl-5 text-muted">
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
