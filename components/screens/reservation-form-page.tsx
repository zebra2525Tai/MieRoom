import "server-only";
import { parsePeriodNo } from "@/lib/domain/periods";
import { checkApplicationDate } from "@/lib/domain/reservation-rules";
import {
  addDays,
  fiscalYearOfDate,
  isSchoolDate,
  schoolToday,
} from "@/lib/domain/school-date";
import { listSchoolClosures } from "@/lib/server/queries/common";
import { loadRoomRows } from "@/lib/server/queries/lessons";
import { loadApprovalFacts } from "@/lib/server/queries/review";
import { SLOTS } from "@/lib/domain/periods";
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
  // The rooms with the state of every slot of the day: 授業, 使用止め, 予約 (R4-1).
  const [{ rooms }, closures] = await Promise.all([
    loadRoomRows(date, fiscalYearOfDate(date), now),
    listSchoolClosures(addDays(date, -60), date),
  ]);
  const requestedRoom = one(params.room);
  const roomId = rooms.find((room) => room.id === requestedRoom)?.id ?? null;
  // MW203 (S12 only): for each slot, the homeroom classes that have a lesson without a room.
  let homeroomNotes: Record<number, string[]> | undefined;
  if (mode === "proxy" && roomId !== null) {
    const facts = await loadApprovalFacts(
      SLOTS.map((slot) => ({
        key: String(slot.no),
        roomId,
        date,
        slots: [slot.no],
      })),
      now,
    );
    homeroomNotes = Object.fromEntries(
      SLOTS.map((slot) => [
        slot.no,
        facts.get(String(slot.no))?.homeroomClassesWithUndecidedLesson ?? [],
      ]),
    );
  }
  return (
    <ReservationFormView
      mode={mode}
      rooms={rooms}
      roomId={roomId}
      date={date}
      today={today}
      periodNo={parsePeriodNo(one(params.period))}
      check={checkApplicationDate(date, now, closures)}
      basePath={basePath}
      homeroomNotes={homeroomNotes}
    />
  );
}
