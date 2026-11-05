import { ForbiddenView } from "@/app/forbidden-view";
import { LinksView, type LinkTab } from "@/components/screens/admin-views";
import { fiscalYearOfDate, schoolToday } from "@/lib/domain/school-date";
import { loadLinks } from "@/lib/server/queries/admin";
import { listClassesForYear } from "@/lib/server/queries/common";
import { hasRole, requireUser } from "@/lib/server/session";
import { one } from "@/lib/url";

// S22 紐づけ
export default async function LinksPage({
  searchParams,
}: PageProps<"/admin/links">) {
  const user = await requireUser();
  if (!hasRole(user, "admin")) return <ForbiddenView />;
  const params = await searchParams;
  const requestedTab = one(params.tab);
  const tab: LinkTab =
    requestedTab === "teachers" || requestedTab === "rooms"
      ? requestedTab
      : "subjects";
  const classes = await listClassesForYear(
    fiscalYearOfDate(schoolToday(new Date())),
  );
  const selected =
    classes.find((item) => item.id === one(params.class)) ?? classes[0] ?? null;
  return (
    <LinksView
      tab={tab}
      classes={classes}
      classId={selected?.id ?? null}
      rows={selected ? await loadLinks(tab, selected.id) : []}
    />
  );
}
