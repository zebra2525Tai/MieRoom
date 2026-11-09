import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { formatLongDate, schoolToday } from "@/lib/domain/school-date";
import { countPending } from "@/lib/server/queries/review";
import { hasRole, requireUser } from "@/lib/server/session";

// Everything behind the login. Each page still checks the user by itself: a layout
// does not run again when moving between pages.
export default async function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  const now = new Date();
  const today = schoolToday(now);
  // Only 先生 see the number of requests waiting (the menu item is theirs).
  const pendingCount = hasRole(user, "teacher")
    ? await countPending(today, now).catch(() => 0)
    : 0;
  return (
    <AppShell
      role={user.role}
      todayText={formatLongDate(today)}
      pendingCount={pendingCount}
    >
      {children}
    </AppShell>
  );
}
