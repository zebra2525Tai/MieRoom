import { ForbiddenView } from "@/app/forbidden-view";
import { TeacherHomeView } from "@/components/screens/reservation-lists";
import { hasRole, requireUser } from "@/lib/server/session";

// S10 先生ホーム。予約の表(E14)がまだないので、一覧は空。
export default async function TeacherHomePage() {
  const user = await requireUser();
  if (!hasRole(user, "teacher")) return <ForbiddenView />;
  return <TeacherHomeView rows={[]} />;
}
