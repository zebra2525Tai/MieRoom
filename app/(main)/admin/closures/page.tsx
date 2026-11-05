import { ForbiddenView } from "@/app/forbidden-view";
import { ClosuresView } from "@/components/screens/admin-views";
import { fiscalYearOfDate, schoolToday } from "@/lib/domain/school-date";
import { loadClosuresOfYear } from "@/lib/server/queries/admin";
import { hasRole, requireUser } from "@/lib/server/session";
import { one } from "@/lib/url";

// S23 休み・行事
export default async function ClosuresPage({
  searchParams,
}: PageProps<"/admin/closures">) {
  const user = await requireUser();
  if (!hasRole(user, "admin")) return <ForbiddenView />;
  const today = schoolToday(new Date());
  const thisYear = fiscalYearOfDate(today);
  const years = [thisYear - 1, thisYear, thisYear + 1];
  const requested = Number(one((await searchParams).year));
  const year = years.includes(requested) ? requested : thisYear;
  const { rows, hasSchoolClosure } = await loadClosuresOfYear(year, today);
  return (
    <ClosuresView
      year={year}
      years={years}
      rows={rows}
      hasSchoolClosure={hasSchoolClosure}
    />
  );
}
