import { ForbiddenView } from "@/app/forbidden-view";
import { ImportView } from "@/components/screens/import-view";
import { monthWindow } from "@/lib/domain/import-window";
import { addMonths, monthOf, schoolToday } from "@/lib/domain/school-date";
import { loadImportRows } from "@/lib/server/queries/admin";
import { hasRole, requireUser } from "@/lib/server/session";

// S20 時間割の取り込み
export default async function ImportPage() {
  const user = await requireUser();
  if (!hasRole(user, "admin")) return <ForbiddenView />;
  const today = schoolToday(new Date());
  const thisMonth = monthOf(today);
  const months: [string, string] = [thisMonth, addMonths(thisMonth, 1)];
  return (
    <ImportView
      months={months}
      windows={[monthWindow(today, months[0]), monthWindow(today, months[1])]}
      rows={await loadImportRows(months)}
    />
  );
}
