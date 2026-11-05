import Link from "next/link";
import { notFound } from "next/navigation";
import { LoginView } from "@/components/screens/login-view";
import { MonitorView } from "@/components/screens/monitor-view";
import { AppShell } from "@/components/shell/app-shell";
import type { Role } from "@/lib/auth/policy";
import { formatLongDate, schoolToday } from "@/lib/domain/school-date";
import { ROLE_LABEL } from "@/lib/nav";
import { one } from "@/lib/url";
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
    return (
      <MonitorView
        todayText="11/20(金)"
        timeText="11:02"
        updatedText="11:00"
        classes={[
          {
            className: "大学併修1年",
            dateText: null,
            periodLabel: "3限",
            subject: "英語A",
            room: "201",
          },
          {
            className: "大学併修2年",
            dateText: null,
            periodLabel: "3限",
            subject: "データ構造",
            room: "302",
          },
          {
            className: "医療情報1年",
            dateText: "11/24(火)",
            periodLabel: "1限",
            subject: "医療概論",
            room: "202",
          },
          {
            className: "医療情報2年",
            dateText: null,
            periodLabel: null,
            subject: "未定",
            room: "未定",
          },
          {
            className: "ゲームITエキスパート1年",
            dateText: null,
            periodLabel: "4限",
            subject: "数学基礎",
            room: "各教室",
          },
          {
            className: "システム専攻2年",
            dateText: null,
            periodLabel: "3限",
            subject: "チーム開発演習",
            room: "603",
          },
        ]}
        rooms={[
          {
            key: "1",
            room: "201",
            lesson: {
              className: "大学併修1年",
              subject: "情報リテラシー",
              teacher: "三和田",
            },
          },
          {
            key: "2",
            room: "601",
            lesson: {
              className: "システム専攻2年",
              subject: "サーバー構築",
              teacher: "政宗",
            },
          },
          { key: "3", room: "504", lesson: null },
          {
            key: "4",
            room: "302",
            lesson: {
              className: "大学併修2年",
              subject: "英語B",
              teacher: "杉本",
            },
          },
        ]}
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
