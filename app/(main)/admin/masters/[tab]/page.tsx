import { notFound } from "next/navigation";
import { ForbiddenView } from "@/app/forbidden-view";
import { MastersView, type MasterTab } from "@/components/screens/admin-views";
import { loadMaster } from "@/lib/server/queries/admin";
import { hasRole, requireUser } from "@/lib/server/session";
import { one } from "@/lib/url";

function parseTab(value: string): MasterTab | null {
  return value === "classes" ||
    value === "teachers" ||
    value === "subjects" ||
    value === "rooms"
    ? value
    : null;
}

// S21 マスタ
export default async function MastersPage({
  params,
  searchParams,
}: PageProps<"/admin/masters/[tab]">) {
  const user = await requireUser();
  if (!hasRole(user, "admin")) return <ForbiddenView />;
  const tab = parseTab((await params).tab);
  if (!tab) notFound();
  const showInactive = one((await searchParams).inactive) === "1";
  return (
    <MastersView
      data={await loadMaster(tab, showInactive)}
      showInactive={showInactive}
    />
  );
}
