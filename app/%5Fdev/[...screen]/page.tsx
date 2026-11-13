import Link from "next/link";
import { notFound } from "next/navigation";
import { LoginView } from "@/components/screens/login-view";
import { MonitorView } from "@/components/screens/monitor-view";
import { monitorChips, monitorPhase } from "@/lib/domain/monitor";
import { AppShell } from "@/components/shell/app-shell";
import type { Role } from "@/lib/auth/policy";
import { formatLongDate, schoolToday } from "@/lib/domain/school-date";
import { ROLE_LABEL } from "@/lib/nav";
import { one } from "@/lib/url";
import { monitorSampleStates } from "../monitor-sample";
import { sampleFor } from "../samples";

const ROLES: Role[] = ["student", "teacher", "admin"];

// One screen with made-up data, inside the real frame. ?role= switches the menu.
export default async function DevScreenPage({
  params,
  searchParams,
}: PageProps<"/_dev/[...screen]">) {
  const { screen } = await params;
  const query = await searchParams;
  const requestedRole = one(query.role);
  const role: Role = ROLES.find((item) => item === requestedRole) ?? "admin";

  if (screen[0] === "s01") {
    return <LoginView message={null} next="/" />;
  }
  if (screen[0] === "s30") {
    // ?phase=break: 休み時間 (次の時限の授業を出す)。ない: 授業中。
    const isBreak = one(query.phase) === "break";
    const phase = monitorPhase(isBreak ? 10 * 60 + 50 : 10 * 60 + 30);
    return (
      <MonitorView
        chips={monitorChips(phase)}
        states={monitorSampleStates(isBreak)}
        dateText="11/13(金)"
        timeText={isBreak ? "10:50" : "10:30"}
        updatedText="10:00"
        stale={false}
      />
    );
  }

  const sample = sampleFor(screen, query, role);
  if (!sample) notFound();

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-[#d5dae6] bg-[#edf0f5] px-4 py-1.5 text-[11px] text-[#4a576c] print:hidden">
        <span className="font-bold">見本(架空のデータ)</span>
        <Link href="/_dev" className="underline">
          画面の一覧
        </Link>
        <span className="ml-auto">表示する役割</span>
        {ROLES.map((item) => (
          <Link
            key={item}
            href={`/_dev/${screen.join("/")}?role=${item}`}
            className={item === role ? "font-bold text-navy" : "underline"}
          >
            {ROLE_LABEL[item]}
          </Link>
        ))}
      </div>
      <AppShell
        role={role}
        todayText={formatLongDate(schoolToday(new Date()))}
        sampleScreenId={sample.menuId}
      >
        {sample.element}
      </AppShell>
    </div>
  );
}
