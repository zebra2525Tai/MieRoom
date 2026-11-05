import { ForbiddenView } from "@/app/forbidden-view";
import { ReservationFormPage } from "@/components/screens/reservation-form-page";
import { hasRole, requireUser } from "@/lib/server/session";

// S12 代理入力
export default async function ProxyReservationPage({
  searchParams,
}: PageProps<"/teacher/reservations/new">) {
  const user = await requireUser();
  if (!hasRole(user, "teacher")) return <ForbiddenView />;
  return (
    <ReservationFormPage
      mode="proxy"
      params={await searchParams}
      basePath="/teacher/reservations/new"
    />
  );
}
