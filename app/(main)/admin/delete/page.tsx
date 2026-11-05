import { ForbiddenView } from "@/app/forbidden-view";
import { DeleteView } from "@/components/screens/admin-views";
import { hasRole, requireUser } from "@/lib/server/session";

// S26 削除管理
export default async function DeletePage() {
  const user = await requireUser();
  if (!hasRole(user, "admin")) return <ForbiddenView />;
  return <DeleteView />;
}
