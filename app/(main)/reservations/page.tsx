import { MyReservationsView } from "@/components/screens/reservation-lists";
import { requireUser } from "@/lib/server/session";

// S07 自分の予約。予約の表(E14)がまだないので、一覧は空。
export default async function MyReservationsPage() {
  await requireUser();
  return <MyReservationsView rows={[]} />;
}
