import Form from "next/form";
import { AutoSubmitInput, AutoSubmitSelect } from "@/components/ui/auto-submit";
import { Button } from "@/components/ui/button";
import { Field, fieldClass, textareaClass } from "@/components/ui/form";
import {
  Callout,
  Card,
  NotReadyNotice,
  PageHeading,
} from "@/components/ui/parts";
import { SLOTS, type PeriodNo } from "@/lib/domain/periods";
import type { ApplicationCheck } from "@/lib/domain/reservation-rules";
import type { RoomRow, SlotStatus } from "@/lib/domain/room-status";
import { addDays, formatDate } from "@/lib/domain/school-date";
import { MESSAGES } from "@/lib/messages";
import { SlotBadge } from "./rooms-view";

function checkMessage(
  check: ApplicationCheck,
  date: string,
  today: string,
): string | null {
  if (check.ok) return null;
  switch (check.code) {
    case "ME101":
      return MESSAGES.ME101(
        formatDate(date, today),
        formatDate(check.deadlineDate, today),
      );
    case "ME102":
      return MESSAGES.ME102(formatDate(addDays(today, 30), today));
    case "ME103":
      return MESSAGES.ME103;
  }
}

function selectable(status: SlotStatus): boolean {
  return status.kind !== "lesson" && status.kind !== "blocked";
}

// S06 予約の申請 / S12 代理入力 (同じ項目・同じ規則。R4-9)
export function ReservationFormView({
  mode,
  rooms,
  roomId,
  date,
  today,
  periodNo,
  check,
  basePath,
}: {
  mode: "apply" | "proxy";
  rooms: RoomRow[];
  roomId: string | null;
  date: string;
  today: string;
  periodNo: PeriodNo | null;
  check: ApplicationCheck;
  basePath: string;
}) {
  const room = rooms.find((item) => item.id === roomId) ?? null;
  const error = checkMessage(check, date, today);
  return (
    <>
      <PageHeading
        title={mode === "apply" ? "予約の申請" : "代理入力"}
        description={
          mode === "apply"
            ? "教室・日付・枠を選んで申請します。先生が承認すると確定します。"
            : "先生が予約を入れます。保存すると、その場で承認済みになります。"
        }
      />
      <NotReadyNotice>
        画面の形を確かめる段階です。予約の表ができてから、申請できるようになります。
      </NotReadyNotice>

      <Card className="mb-4 p-5 sm:p-6">
        <Form action={basePath} className="grid gap-4 sm:grid-cols-2">
          {periodNo && <input type="hidden" name="period" value={periodNo} />}
          <Field label="教室" required>
            <AutoSubmitSelect
              key={roomId ?? "none"}
              name="room"
              defaultValue={roomId ?? ""}
              className={fieldClass}
            >
              <option value="">選んでください</option>
              {rooms.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.building ? `(${item.building})` : ""}
                </option>
              ))}
            </AutoSubmitSelect>
          </Field>
          <Field
            label="日付"
            required
            help={`締め切り: ${formatDate(check.deadlineDate, today)} 12:00 / 30日先まで`}
            error={error ?? undefined}
          >
            <AutoSubmitInput
              key={date}
              type="date"
              name="date"
              min={today}
              max={addDays(today, 30)}
              defaultValue={date}
              className={fieldClass}
            />
          </Field>
          <noscript>
            <button type="submit">表示</button>
          </noscript>
        </Form>
      </Card>

      <Card className="p-5 sm:p-6">
        <form className="flex flex-col gap-5">
          <fieldset>
            <legend className="mb-2 text-xs font-semibold">
              枠<span className="ml-1.5 text-[11px] text-[#a75c4c]">必須</span>
              <span className="ml-2 font-normal text-muted">
                続けて選んでください
              </span>
            </legend>
            {room ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {SLOTS.map((slot) => {
                  const status = room.slots[slot.no];
                  const enabled = selectable(status);
                  return (
                    <label
                      key={slot.no}
                      className={`flex items-center gap-2.5 rounded-lg border border-line p-3 text-xs ${
                        enabled ? "cursor-pointer" : "bg-[#f7f9fa] opacity-70"
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="slots"
                        value={slot.no}
                        disabled={!enabled}
                        defaultChecked={enabled && slot.periodNo === periodNo}
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold">
                          {slot.label}
                        </span>
                        <span className="block text-[11px] text-muted">
                          {slot.start}-{slot.end}
                        </span>
                      </span>
                      <span className="ml-auto">
                        <SlotBadge status={status} />
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <Callout kind="neutral" className="">
                先に教室を選ぶと、枠の状態が出ます。
              </Callout>
            )}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="用途" required>
              <select name="purpose" defaultValue="" className={fieldClass}>
                <option value="" disabled>
                  選んでください
                </option>
                <option>自習</option>
                <option>就活</option>
                <option>その他</option>
              </select>
            </Field>
            <Field label="申請者">
              <input
                readOnly
                value={mode === "apply" ? "ログイン中の人" : "ログイン中の先生"}
                className={`${fieldClass} bg-[#f4f7f9] text-[#7b8d99]`}
              />
            </Field>
            <Field label="備考" full help="100文字まで">
              <textarea name="note" maxLength={100} className={textareaClass} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" disabled>
              {mode === "apply" ? "申請する" : "保存する"}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
