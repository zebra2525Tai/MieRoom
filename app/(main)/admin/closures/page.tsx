import { ForbiddenView } from "@/app/forbidden-view";
import { ClosuresView } from "@/components/screens/admin-views";
import { fiscalYearOfDate, schoolToday } from "@/lib/domain/school-date";
import { noticeText } from "@/lib/notice";
import { loadClosuresOfYear } from "@/lib/server/queries/admin";
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

// S23 休み・行事
export default async function ClosuresPage({
  searchParams,
}: PageProps<"/admin/closures">) {
  const user = await requireUser();
  if (!hasRole(user, "admin")) return <ForbiddenView />;
  const today = schoolToday(new Date());
  const thisYear = fiscalYearOfDate(today);
  const years = [thisYear - 1, thisYear, thisYear + 1];
  const params = await searchParams;
  const requested = Number(one(params.year));
  const year = years.includes(requested) ? requested : thisYear;
  const [{ rows, hasSchoolClosure }, classes] = await Promise.all([
    loadClosuresOfYear(year, today),
    listClassesForYear(year),
  ]);
  return (
    <ClosuresView
      year={year}
      years={years}
      rows={rows}
      hasSchoolClosure={hasSchoolClosure}
      classes={classes}
      notice={noticeText(one(params.notice))}
      fixCount={count(one(params.fix))}
    />
  );
}
