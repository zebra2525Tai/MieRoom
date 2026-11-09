import Form from "next/form";
import { AutoSubmitInput, AutoSubmitSelect } from "@/components/ui/auto-submit";
import { Field, fieldClass } from "@/components/ui/form";
import { Card, NotReadyNotice, PageHeading } from "@/components/ui/parts";
import type { PeriodNo } from "@/lib/domain/periods";
import type { ApplicationCheck } from "@/lib/domain/reservation-rules";
import type { RoomRow } from "@/lib/domain/room-status";
import { addDays, formatDate } from "@/lib/domain/school-date";
import { MESSAGES } from "@/lib/messages";
import { ReservationForm } from "./reservation-form";

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
      {mode === "proxy" && (
        <NotReadyNotice>
          代理入力は、次の段階で動くようにします。いまは保存できません。
        </NotReadyNotice>
      )}

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

      <ReservationForm
        key={`${roomId}-${date}`}
        endpoint={
          mode === "apply"
            ? "/reservations/apply"
            : "/teacher/reservations/proxy"
        }
        successPath={
          mode === "apply" ? "/reservations" : "/teacher/reservations"
        }
        roomId={room?.id ?? null}
        date={date}
        periodNo={periodNo}
        statuses={room?.slots ?? null}
        submitLabel={mode === "apply" ? "申請する" : "保存する"}
        applicantLabel={
          mode === "apply" ? "ログイン中の人" : "ログイン中の先生"
        }
        disabled={mode === "proxy"}
      />
    </>
  );
}
