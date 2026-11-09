import { MyReservationsView } from "@/components/screens/reservation-lists";
import { schoolToday } from "@/lib/domain/school-date";
import { noticeText, pageNumber } from "@/lib/notice";
import { listMyReservations } from "@/lib/server/queries/reservations";
import { requireUser } from "@/lib/server/session";
import { one } from "@/lib/url";

// S07 自分の予約
export default async function MyReservationsPage({
  searchParams,
}: PageProps<"/reservations">) {
  const user = await requireUser();
  const params = await searchParams;
  const now = new Date();
  const page = pageNumber(one(params.page));
  const { rows, hasNext } = await listMyReservations(
    user.id,
    schoolToday(now),
    now,
    page,
  );
  return (
    <MyReservationsView
      rows={rows}
      page={page}
      hasNext={hasNext}
      notice={noticeText(one(params.notice))}
    />
  );
}
