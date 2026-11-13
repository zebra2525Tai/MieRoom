import { ForbiddenView } from "@/app/forbidden-view";
import { MonitorsView } from "@/components/screens/admin-views";
import { noticeText } from "@/lib/notice";
import { listMonitors } from "@/lib/server/monitor";
import { hasRole, requireUser } from "@/lib/server/session";
import { one } from "@/lib/url";

// S27 モニターURL。合言葉つきの URL は、この画面でだけ見られる (時間割管理者だけ)。
export default async function MonitorsPage({
  searchParams,
}: PageProps<"/admin/monitors">) {
  const user = await requireUser();
  if (!hasRole(user, "admin")) return <ForbiddenView />;
  const params = await searchParams;
  return (
    <MonitorsView
      monitors={await listMonitors()}
      notice={noticeText(one(params.notice))}
    />
  );
}
