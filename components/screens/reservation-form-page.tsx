import "server-only";
import { parsePeriodNo } from "@/lib/domain/periods";
import { checkApplicationDate } from "@/lib/domain/reservation-rules";
import { addDays, isSchoolDate, schoolToday } from "@/lib/domain/school-date";
import { listSchoolClosures, loadRoomList } from "@/lib/server/queries/common";
import { one } from "@/lib/url";
import { ReservationFormView } from "./reservation-form-view";

// Data for S06 and S12, which share their items and rules (R4-9).
// Callers check the role first.
export async function ReservationFormPage({
  mode,
  params,
  basePath,
}: {
  mode: "apply" | "proxy";
  params: Record<string, string | string[] | undefined>;
  basePath: string;
}) {
  const now = new Date();
  const today = schoolToday(now);
  const requestedDate = one(params.date);
  const date = isSchoolDate(requestedDate) ? requestedDate : addDays(today, 1);
  const [rooms, closures] = await Promise.all([
    loadRoomList(),
    listSchoolClosures(addDays(date, -60), date),
  ]);
  const requestedRoom = one(params.room);
  return (
    <ReservationFormView
      mode={mode}
      rooms={rooms}
      roomId={rooms.find((room) => room.id === requestedRoom)?.id ?? null}
      date={date}
      today={today}
      periodNo={parsePeriodNo(one(params.period))}
      check={checkApplicationDate(date, now, closures)}
      basePath={basePath}
    />
  );
}
