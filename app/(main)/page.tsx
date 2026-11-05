import { HomeView } from "@/components/screens/home-view";
import { closureNamesOn } from "@/lib/domain/closures";
import { fiscalYearOfDate, schoolToday } from "@/lib/domain/school-date";
import {
  listClassesForYear,
  listClosuresForClass,
} from "@/lib/server/queries/common";
import { requireUser } from "@/lib/server/session";
import { one } from "@/lib/url";

// S02 ホーム
export default async function HomePage({ searchParams }: PageProps<"/">) {
  await requireUser();
  const params = await searchParams;
  const today = schoolToday(new Date());
  const year = fiscalYearOfDate(today);
  const classes = await listClassesForYear(year);
  const requested = one(params.class);
  const selected = classes.find((item) => item.id === requested) ?? null;
  const closures = await listClosuresForClass(
    today,
    today,
    selected?.id ?? null,
  );

  return (
    <HomeView
      today={today}
      classes={classes}
      selectedClassId={selected?.id ?? null}
      todayFiscalYear={year}
      yearChanged={one(params.notice) === "year-changed"}
      // 授業の表(E10)がまだないので、いまの授業・次の授業は未定。
      lessons={{ kind: "undecided" }}
      closures={closureNamesOn(today, closures)}
    />
  );
}
