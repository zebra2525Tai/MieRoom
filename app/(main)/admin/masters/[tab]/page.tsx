import { notFound } from "next/navigation";
import { ForbiddenView } from "@/app/forbidden-view";
import { MastersView, type MasterTab } from "@/components/screens/admin-views";
import { fiscalYearOfDate, schoolToday } from "@/lib/domain/school-date";
import { noticeText } from "@/lib/notice";
import { loadMaster } from "@/lib/server/queries/admin";
import { loadRoomList } from "@/lib/server/queries/common";
import { hasRole, requireUser } from "@/lib/server/session";
import { one } from "@/lib/url";

function parseTab(value: string): MasterTab | null {
  return value === "classes" ||
    value === "teachers" ||
    value === "subjects" ||
    value === "rooms"
    ? value
    : null;
}

/** A count from the address (MW502): a whole number, or nothing. */
const count = (value: string | undefined) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 100_000
    ? number
    : 0;
};

// S21 マスタ
export default async function MastersPage({
  params,
  searchParams,
}: PageProps<"/admin/masters/[tab]">) {
  const user = await requireUser();
  if (!hasRole(user, "admin")) return <ForbiddenView />;
  const tab = parseTab((await params).tab);
  if (!tab) notFound();
  const query = await searchParams;
  const showInactive = one(query.inactive) === "1";
  // The rooms are only needed for the 教室 box of a class.
  const rooms = tab === "classes" ? await loadRoomList() : [];
  return (
    <MastersView
      data={await loadMaster(tab, showInactive)}
      showInactive={showInactive}
      rooms={rooms.map((room) => ({ id: room.id, name: room.name }))}
      defaultYear={fiscalYearOfDate(schoolToday(new Date()))}
      notice={noticeText(one(query.notice))}
      renamed={one(query.renamed) === "1"}
      fixCount={count(one(query.fix))}
    />
  );
}
