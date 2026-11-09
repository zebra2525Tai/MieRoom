import { ForbiddenView } from "@/app/forbidden-view";
import { TeacherReservationsView } from "@/components/screens/reservation-lists";
import { addDays, isSchoolDate, schoolToday } from "@/lib/domain/school-date";
import { loadRoomList } from "@/lib/server/queries/common";
import { hasRole, requireUser } from "@/lib/server/session";
import { one } from "@/lib/url";

// S11 予約の一覧。予約の表(E14)がまだないので、一覧は空。
export default async function TeacherReservationsPage({
  searchParams,
}: PageProps<"/teacher/reservations">) {
  const user = await requireUser();
  if (!hasRole(user, "teacher")) return <ForbiddenView />;
  const params = await searchParams;
  const today = schoolToday(new Date());
  const start = one(params.start);
  const end = one(params.end);
  const rooms = await loadRoomList();
  return (
    <TeacherReservationsView
      rows={[]}
      rooms={rooms}
      status={one(params.status) ?? ""}
      roomId={one(params.room) ?? ""}
      start={isSchoolDate(start) ? start : today}
      end={isSchoolDate(end) ? end : addDays(today, 30)}
    />
  );
}
