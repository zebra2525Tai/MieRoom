import { ForbiddenView } from "@/app/forbidden-view";
import { ExportView } from "@/components/screens/admin-views";
import { fiscalYearOfDate, schoolToday } from "@/lib/domain/school-date";
import { hasRole, requireUser } from "@/lib/server/session";

// S24 CSV書き出し
export default async function ExportPage() {
  const user = await requireUser();
  if (!hasRole(user, "admin")) return <ForbiddenView />;
  return (
    <ExportView
      yearLabel={`今年度(${fiscalYearOfDate(schoolToday(new Date()))}年度)`}
    />
  );
}
