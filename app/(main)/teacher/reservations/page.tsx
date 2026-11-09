import { ForbiddenView } from "@/app/forbidden-view";
import { TeacherReservationsView } from "@/components/screens/reservation-lists";
import type { ReservationStatus } from "@/lib/domain/reservation-core";
import { addDays, isSchoolDate, schoolToday } from "@/lib/domain/school-date";
import { noticeText, pageNumber } from "@/lib/notice";
import { findBlock } from "@/lib/server/queries/blocks";
import { loadRoomList } from "@/lib/server/queries/common";
import { listTeacherRows } from "@/lib/server/queries/review";
import { hasRole, requireUser } from "@/lib/server/session";
import { one } from "@/lib/url";

const STATUSES: readonly string[] = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "withdrawn",
  "expired",
];

// S11 予約の一覧(先生)
export default async function TeacherReservationsPage({
  searchParams,
}: PageProps<"/teacher/reservations">) {
  const user = await requireUser();
  if (!hasRole(user, "teacher")) return <ForbiddenView />;
  const params = await searchParams;
  const now = new Date();
  const today = schoolToday(now);
  const requestedStart = one(params.start);
  const requestedEnd = one(params.end);
  const status = one(params.status) ?? "";
  const requestedRoom = one(params.room) ?? "";
  const page = pageNumber(one(params.page));
  const rooms = await loadRoomList();
  const roomId = rooms.some((room) => room.id === requestedRoom)
    ? requestedRoom
    : "";
  // From S13: the 使用止め whose approved reservations are wanted.
  const block = await findBlock(one(params.block));
  const start = isSchoolDate(requestedStart) ? requestedStart : today;
  const end = isSchoolDate(requestedEnd) ? requestedEnd : addDays(today, 30);
  const { rows, hasNext } = await listTeacherRows(
    {
      status: STATUSES.includes(status) ? (status as ReservationStatus) : null,
      start: block ? block.startDate : start,
      end: block ? block.endDate : end,
      roomId: roomId || null,
      block,
    },
    today,
    now,
    page,
  );
  return (
    <TeacherReservationsView
      rows={rows}
      rooms={rooms}
      status={status}
      roomId={roomId}
      start={start}
      end={end}
      page={page}
      hasNext={hasNext}
      fromBlock={block !== null}
      notice={noticeText(one(params.notice))}
    />
  );
}
