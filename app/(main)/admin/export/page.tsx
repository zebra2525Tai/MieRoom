import { ForbiddenView } from "@/app/forbidden-view";
import { ExportView } from "@/components/screens/admin-views";
import { MASTER_FILES, type MasterFileKey } from "@/lib/domain/master-csv";
import { buildExport } from "@/lib/domain/master-export";
import { fiscalYearOfDate, schoolToday } from "@/lib/domain/school-date";
import { loadExportSource } from "@/lib/server/queries/export";
import { hasRole, requireUser } from "@/lib/server/session";

// S24 CSV書き出し
export default async function ExportPage() {
  const user = await requireUser();
  if (!hasRole(user, "admin")) return <ForbiddenView />;
  const year = fiscalYearOfDate(schoolToday(new Date()));
  const result = buildExport(await loadExportSource(year));
  return (
    <ExportView
      yearLabel={`今年度(${year}年度)`}
      files={(Object.keys(MASTER_FILES) as MasterFileKey[]).map((key) => ({
        name: MASTER_FILES[key],
        rows: result.rowCounts[key],
      }))}
      issues={result.issues}
    />
  );
}
