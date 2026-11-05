import { ForbiddenView } from "@/app/forbidden-view";
import { AccessView } from "@/components/screens/admin-views";
import { loadAccess } from "@/lib/server/queries/admin";
import { hasRole, requireUser } from "@/lib/server/session";

// S25 タグ・受信機
export default async function AccessPage() {
  const user = await requireUser();
  if (!hasRole(user, "admin")) return <ForbiddenView />;
  return <AccessView {...await loadAccess()} />;
}
