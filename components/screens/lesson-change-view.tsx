import { Button, LinkButton } from "@/components/ui/button";
import { Field, fieldClass } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Card, NotReadyNotice, PageHeading } from "@/components/ui/parts";
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
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
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
  return (
    <>
      <PageHeading
        title="授業の変更"
        description="その日だけの変更をします。大規模な修正は、担任がツールを直して取り込み直します。"
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
        <Card className="p-5 sm:p-6">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold">対象の授業</h2>
            <LessonBadges lesson={lesson} />
          </div>
          <dl>
            <ReadOnlyRow label="クラス" value={className} />
            <ReadOnlyRow label="日付" value={formatDate(lesson.date, today)} />
            <ReadOnlyRow
              label="時限"
              value={`${periodLabel(lesson.periodNo)} ${periodTime(lesson.periodNo)}`}
            />
            <ReadOnlyRow label="科目" value={lesson.subject} />
            <ReadOnlyRow label="いまの教室" value={roomText(lesson.room)} />
            <ReadOnlyRow
              label="いまの講師"
              value={teacherText(lesson.teachers)}
            />
          </dl>
          {(lesson.previousRoom !== null ||
            lesson.previousTeachers !== null) && (
            <div className="mt-4 rounded-[10px] border border-[#d6e9e1] bg-[#edf6f3] p-4 text-xs text-teal-dark">
              <div className="mb-1 font-semibold">取り込んだときの内容</div>
              {lesson.previousRoom !== null && (
                <div>教室: {roomText(lesson.previousRoom)}</div>
              )}
              {lesson.previousTeachers !== null && (
                <div>講師: {teacherText(lesson.previousTeachers)}</div>
              )}
            </div>
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
                className={fieldClass}
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
            <Field
              label="講師"
              help="複数選べます。選ばないと「各担当」です。同じ時間に別の授業を担当している講師は選べません。"
            >
              <select
                name="teachers"
                multiple
                defaultValue={teachers
                  .filter((teacher) => lesson.teachers.includes(teacher.name))
                  .map((teacher) => teacher.id)}
                className="h-32 w-full rounded-[7px] border border-[#d8e3eb] bg-white px-2 py-1.5 text-xs font-normal text-ink"
              >
                {teachers.map((teacher) => (
                  <option
                    key={teacher.id}
                    value={teacher.id}
                    disabled={teacher.busy}
                  >
                    {teacher.name}
                    {teacher.busy ? "(別の授業を担当)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
              <Button variant="danger" disabled>
                {lesson.cancelled ? "休講を取り消す" : "休講にする"}
              </Button>
              <Button type="submit" variant="primary" disabled>
                変更を保存
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
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
  return (
    <>
      <PageHeading
        title="授業を足す(補講)"
        description="今日以降で、時間割が入力済みの日に足せます。"
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
      <Card className="max-w-3xl p-5 sm:p-6">
        <form className="grid gap-4 sm:grid-cols-2">
          <Field label="クラス">
            <input
              readOnly
              value={className}
              className={`${fieldClass} bg-[#f4f7f9] text-[#7b8d99]`}
            />
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
            <select name="period" className={fieldClass}>
              {PERIODS.map((period) => (
                <option key={period.no} value={period.no}>
                  {period.label} {period.start}-{period.end}
                </option>
              ))}
            </select>
          </Field>
          <Field label="科目" required>
            <select name="subject" defaultValue="" className={fieldClass}>
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
            <select name="room" defaultValue="" className={fieldClass}>
              <option value="">ー(教室未定)</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="講師" help="空欄は「各担当」です。">
            <select name="teachers" defaultValue="" className={fieldClass}>
              <option value="">各担当</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" variant="primary" disabled>
              補講を追加
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
