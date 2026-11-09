import { Button, LinkButton } from "@/components/ui/button";
import {
  Field,
  FormActions,
  choiceCheckedClass,
  fieldClass,
  readOnlyFieldClass,
  selectClass,
} from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import {
  Badge,
  Callout,
  Card,
  NotReadyNotice,
  PageHeading,
} from "@/components/ui/parts";
import { PERIODS } from "@/lib/domain/periods";
import { slotStatusLabel, type SlotStatus } from "@/lib/domain/room-status";
import { formatDate } from "@/lib/domain/school-date";
import {
  LessonBadges,
  periodLabel,
  periodTime,
  roomText,
  teacherText,
  type LessonView,
} from "./lesson-parts";

export type RoomChoice = { id: string; name: string; status: SlotStatus };
export type TeacherChoice = { id: string; name: string; busy: boolean };

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-5 border-b border-line py-3 text-xs">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{value}</dd>
    </div>
  );
}

const TEACHERS_HELP_ID = "lesson-teachers-help";

/**
 * 講師を選ぶチェックボックスの一覧。送る値は以前の <select multiple> と同じ
 * (name="teachers"、値は講師のID、別の授業を担当している講師は選べない)。
 */
function TeacherChecks({
  teachers,
  selected,
  help,
}: {
  teachers: TeacherChoice[];
  selected: string[];
  help: string;
}) {
  return (
    <fieldset aria-describedby={TEACHERS_HELP_ID} className="min-w-0">
      <legend className="mb-1.5 text-xs font-semibold">講師</legend>
      {/* 講師が多いときは枠の中でスクロールする。p-1 はフォーカスの輪が切れないための余白 */}
      {/* 13rem: 名前と「別の授業を担当」が1行に収まる幅。行の高さがそろう */}
      <div className="-m-1 grid max-h-72 grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-1.5 overflow-y-auto overscroll-contain p-1">
        {teachers.map((teacher) => (
          <label
            key={teacher.id}
            className={`flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-white px-3 py-2 text-xs text-ink not-has-disabled:hover:border-[#8a96ad] ${choiceCheckedClass} has-disabled:cursor-not-allowed has-disabled:bg-[#f6f8fc] has-disabled:text-muted`}
          >
            <input
              type="checkbox"
              name="teachers"
              value={teacher.id}
              defaultChecked={selected.includes(teacher.name)}
              disabled={teacher.busy}
              className="size-4 shrink-0 accent-brand"
            />
            <span className="flex min-w-0 items-center gap-2">
              <span className="min-w-0">{teacher.name}</span>
              {teacher.busy && <Badge>別の授業を担当</Badge>}
            </span>
          </label>
        ))}
      </div>
      <p id={TEACHERS_HELP_ID} className="mt-1.5 text-[11px] text-muted">
        {help}
      </p>
    </fieldset>
  );
}

// S14 授業の変更 (R3-11): 教室・講師の変更と、休講
export function LessonChangeView({
  lesson,
  className,
  today,
  rooms,
  teachers,
  backHref,
}: {
  lesson: LessonView;
  className: string;
  today: string;
  rooms: RoomChoice[];
  teachers: TeacherChoice[];
  backHref: string;
}) {
  // One width for the heading, the notice and both cards (max-w-6xl), so their right
  // edges line up and the select and the checkboxes do not stretch on very wide
  // screens. The read-only card keeps its own height (lg:self-start).
  return (
    <div className="max-w-6xl">
      <PageHeading
        title="授業の変更"
        actions={
          <LinkButton href={backHref}>
            <Icon name="back" size={15} />
            時間割へ戻る
          </LinkButton>
        }
      />
      <NotReadyNotice>
        画面の形を確かめる段階です。授業の表ができてから、変更できるようになります。
      </NotReadyNotice>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card className="p-5 sm:p-6 lg:self-start">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold">対象の授業</h2>
            <LessonBadges lesson={lesson} />
          </div>
          {/* 変える授業(日付・時限・科目)をいちばん目立たせる */}
          <p className="mt-3 text-lg font-bold leading-snug">
            {formatDate(lesson.date, today)} {periodLabel(lesson.periodNo)}{" "}
            {lesson.subject}
          </p>
          <p className="mt-1 text-xs text-muted">
            {periodTime(lesson.periodNo)}・{className}
          </p>
          <dl className="mt-4 border-t border-line">
            <ReadOnlyRow label="いまの教室" value={roomText(lesson.room)} />
            <ReadOnlyRow
              label="いまの講師"
              value={teacherText(lesson.teachers)}
            />
          </dl>
          {(lesson.previousRoom !== null ||
            lesson.previousTeachers !== null) && (
            <Callout kind="info" className="mt-4">
              <div className="mb-1 font-semibold">取り込んだときの内容</div>
              {lesson.previousRoom !== null && (
                <div>教室: {roomText(lesson.previousRoom)}</div>
              )}
              {lesson.previousTeachers !== null && (
                <div>講師: {teacherText(lesson.previousTeachers)}</div>
              )}
            </Callout>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 text-base font-bold">変更する内容</h2>
          <form className="flex flex-col gap-4">
            <Field
              label="教室"
              help="同じ時間に別の授業で使われている教室は選べません。予約・使用止めと重なるときは、保存のときに警告します。"
            >
              <select
                name="room"
                defaultValue={
                  rooms.find((room) => room.name === lesson.room)?.id ?? ""
                }
                className={selectClass}
              >
                <option value="">ー(教室未定)</option>
                {rooms.map((room) => (
                  <option
                    key={room.id}
                    value={room.id}
                    disabled={room.status.kind === "lesson"}
                  >
                    {room.name} — {slotStatusLabel(room.status)}
                  </option>
                ))}
              </select>
            </Field>
            <TeacherChecks
              teachers={teachers}
              selected={lesson.teachers}
              help="複数選べます。選ばないと「各担当」です。同じ時間に別の授業を担当している講師は選べません。"
            />
            {/* 休講は左、保存は右。スマホでは保存が上 */}
            <FormActions className="border-t border-line pt-4">
              <Button variant="danger" className="sm:mr-auto" disabled>
                {lesson.cancelled ? "休講を取り消す" : "休講にする"}
              </Button>
              <Button type="submit" variant="primary" disabled>
                変更を保存
              </Button>
            </FormActions>
          </form>
        </Card>
      </div>
    </div>
  );
}

// S14 授業を足す(補講)
export function LessonAddView({
  className,
  date,
  subjects,
  rooms,
  teachers,
  backHref,
}: {
  className: string;
  date: string;
  subjects: { id: string; name: string }[];
  rooms: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
  backHref: string;
}) {
  // The heading, the notice and the form share one width, so the back button lines
  // up with the form's right edge.
  return (
    <div className="max-w-4xl">
      <PageHeading
        title="授業を足す(補講)"
        actions={
          <LinkButton href={backHref}>
            <Icon name="back" size={15} />
            時間割へ戻る
          </LinkButton>
        }
      />
      <NotReadyNotice>
        画面の形を確かめる段階です。授業の表ができてから、足せるようになります。
      </NotReadyNotice>
      <Card className="p-5 sm:p-6">
        <form className="grid gap-4 sm:grid-cols-2">
          <Field label="クラス">
            <input readOnly value={className} className={readOnlyFieldClass} />
          </Field>
          <Field label="日付" required>
            <input
              type="date"
              name="date"
              defaultValue={date}
              className={fieldClass}
            />
          </Field>
          <Field label="時限" required>
            <select name="period" className={selectClass}>
              {PERIODS.map((period) => (
                <option key={period.no} value={period.no}>
                  {period.label} {period.start}-{period.end}
                </option>
              ))}
            </select>
          </Field>
          <Field label="科目" required>
            <select name="subject" defaultValue="" className={selectClass}>
              <option value="" disabled>
                選んでください
              </option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="教室" required>
            <select name="room" defaultValue="" className={selectClass}>
              <option value="">ー(教室未定)</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="講師" help="空欄は「各担当」です。">
            <select name="teachers" defaultValue="" className={selectClass}>
              <option value="">各担当</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </Field>
          <FormActions className="sm:col-span-2">
            <Button type="submit" variant="primary" disabled>
              補講を追加
            </Button>
          </FormActions>
        </form>
      </Card>
    </div>
  );
}
