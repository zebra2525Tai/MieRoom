import { MyReservationsView } from "@/components/screens/reservation-lists";
import { MESSAGES } from "@/lib/messages";
import { schoolToday } from "@/lib/domain/school-date";
import { listMyReservations } from "@/lib/server/queries/reservations";
import { requireUser } from "@/lib/server/session";
import { one } from "@/lib/url";

// What was just done (MI101, MI102). Only these two ids are accepted from the address.
const NOTICES = { MI101: MESSAGES.MI101, MI102: MESSAGES.MI102 } as const;

// S07 自分の予約
export default async function MyReservationsPage({
  searchParams,
}: PageProps<"/reservations">) {
  const user = await requireUser();
  const params = await searchParams;
  const now = new Date();
  const requested = Number(one(params.page));
  const page = Number.isInteger(requested) && requested >= 1 ? requested : 1;
  const notice = one(params.notice);
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
      notice={
        notice !== undefined && Object.hasOwn(NOTICES, notice)
          ? NOTICES[notice as keyof typeof NOTICES]
          : null
      }
    />
  );
}
