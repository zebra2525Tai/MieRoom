import { ForbiddenView } from "@/app/forbidden-view";
import { DeleteView } from "@/components/screens/admin-views";
import type { MasterKind } from "@/lib/domain/master-edit";
import { noticeText } from "@/lib/notice";
import { loadDeletionRows } from "@/lib/server/queries/deletion";
import { hasRole, requireUser } from "@/lib/server/session";
import { one } from "@/lib/url";

const TABS: readonly MasterKind[] = [
  "classes",
  "teachers",
  "subjects",
  "rooms",
];

// S26 削除管理
export default async function DeletePage({
  searchParams,
}: PageProps<"/admin/delete">) {
  const user = await requireUser();
  if (!hasRole(user, "admin")) return <ForbiddenView />;
  const params = await searchParams;
  const requested = one(params.tab);
  const tab: MasterKind = TABS.find((item) => item === requested) ?? "classes";
  return (
    <DeleteView
      tab={tab}
      rows={await loadDeletionRows(tab, new Date())}
      notice={noticeText(one(params.notice))}
    />
  );
}
