import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { formatLongDate, schoolToday } from "@/lib/domain/school-date";
import { requireUser } from "@/lib/server/session";

// Everything behind the login. Each page still checks the user by itself: a layout
// does not run again when moving between pages.
export default async function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  return (
    <AppShell
      role={user.role}
      todayText={formatLongDate(schoolToday(new Date()))}
    >
      {children}
    </AppShell>
  );
}
