import { TeachersView } from "@/components/screens/teachers-view";
import { fiscalYearOfDate, schoolToday } from "@/lib/domain/school-date";
import { loadTeacherDirectory } from "@/lib/server/queries/common";
import { requireUser } from "@/lib/server/session";
import { one } from "@/lib/url";

// S05 先生一覧
export default async function TeachersPage({
  searchParams,
}: PageProps<"/teachers">) {
  await requireUser();
  const params = await searchParams;
  const query = (one(params.q) ?? "").trim().slice(0, 20);
  const teachers = await loadTeacherDirectory(
    fiscalYearOfDate(schoolToday(new Date())),
    query,
  );
  return <TeachersView teachers={teachers} query={query} />;
}
