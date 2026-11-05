import { ReservationFormPage } from "@/components/screens/reservation-form-page";
import { requireUser } from "@/lib/server/session";

// S06 予約の申請
export default async function NewReservationPage({
  searchParams,
}: PageProps<"/reservations/new">) {
  await requireUser();
  return (
    <ReservationFormPage
      mode="apply"
      params={await searchParams}
      basePath="/reservations/new"
    />
  );
}
