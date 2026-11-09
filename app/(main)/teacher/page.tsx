import { ForbiddenView } from "@/app/forbidden-view";
import { TeacherHomeView } from "@/components/screens/reservation-lists";
import { schoolToday } from "@/lib/domain/school-date";
import { noticeText, pageNumber } from "@/lib/notice";
import { listPendingRows } from "@/lib/server/queries/review";
import { hasRole, requireUser } from "@/lib/server/session";
import { one } from "@/lib/url";

// S10 先生ホーム(承認待ち)
export default async function TeacherHomePage({
  searchParams,
}: PageProps<"/teacher">) {
  const user = await requireUser();
  if (!hasRole(user, "teacher")) return <ForbiddenView />;
  const params = await searchParams;
  const now = new Date();
  const page = pageNumber(one(params.page));
  const { rows, total, hasNext } = await listPendingRows(
    schoolToday(now),
    now,
    page,
  );
  return (
    <TeacherHomeView
      rows={rows}
      total={total}
      page={page}
      hasNext={hasNext}
      notice={noticeText(one(params.notice))}
    />
  );
}
