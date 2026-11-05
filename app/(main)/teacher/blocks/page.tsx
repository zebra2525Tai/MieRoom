import { ForbiddenView } from "@/app/forbidden-view";
import { BlocksView } from "@/components/screens/blocks-view";
import { schoolToday } from "@/lib/domain/school-date";
import { loadRoomRows } from "@/lib/server/queries/common";
import { hasRole, requireUser } from "@/lib/server/session";

// S13 使用止め。使用止めの表(E16)がまだないので、一覧は空。
export default async function BlocksPage() {
  const user = await requireUser();
  if (!hasRole(user, "teacher")) return <ForbiddenView />;
  const rooms = await loadRoomRows();
  return <BlocksView rows={[]} rooms={rooms} today={schoolToday(new Date())} />;
}
