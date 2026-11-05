import { ForbiddenView } from "@/app/forbidden-view";
import { MonitorsView } from "@/components/screens/admin-views";
import { hasRole, requireUser } from "@/lib/server/session";

// S27 モニターURL
export default async function MonitorsPage() {
  const user = await requireUser();
  if (!hasRole(user, "admin")) return <ForbiddenView />;
  return <MonitorsView />;
}
