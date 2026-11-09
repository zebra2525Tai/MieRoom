import { ForbiddenView } from "@/app/forbidden-view";
import { LinksView, type LinkTab } from "@/components/screens/admin-views";
import { fiscalYearOfDate, schoolToday } from "@/lib/domain/school-date";
import { noticeText } from "@/lib/notice";
import { loadLinkChoices, loadLinks } from "@/lib/server/queries/admin";
import { listClassesForYear } from "@/lib/server/queries/common";
import { hasRole, requireUser } from "@/lib/server/session";
import { one } from "@/lib/url";

/** A count from the address (MW502): a whole number, or nothing. */
const count = (value: string | undefined) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 100_000
    ? number
    : 0;
};

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
  const [rows, choices] = selected
    ? await Promise.all([
        loadLinks(tab, selected.id),
        loadLinkChoices(selected.id),
      ])
    : [[], { newSubjects: [], classSubjects: [], teachers: [], rooms: [] }];
  return (
    <LinksView
      tab={tab}
      classes={classes}
      classId={selected?.id ?? null}
      rows={rows}
      choices={choices}
      notice={noticeText(one(params.notice))}
      fixCount={count(one(params.fix))}
    />
  );
}
