import { ForbiddenView } from "@/app/forbidden-view";
import { BlocksView } from "@/components/screens/blocks-view";
import { schoolToday } from "@/lib/domain/school-date";
import { noticeText } from "@/lib/notice";
import { listBlocks } from "@/lib/server/queries/blocks";
import { loadRoomList } from "@/lib/server/queries/common";
import { hasRole, requireUser } from "@/lib/server/session";
import { one } from "@/lib/url";

/** A count from the address (MW301, MW302): a whole number, or nothing. */
const count = (value: string | undefined) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 100_000
    ? number
    : 0;
};

// S13 使用止め
export default async function BlocksPage({
  searchParams,
}: PageProps<"/teacher/blocks">) {
  const user = await requireUser();
  if (!hasRole(user, "teacher")) return <ForbiddenView />;
  const params = await searchParams;
  const now = new Date();
  const today = schoolToday(now);
  const notice = one(params.notice);
  const [rooms, rows] = await Promise.all([
    loadRoomList(),
    listBlocks(today, now),
  ]);
  return (
    <BlocksView
      rows={rows}
      rooms={rooms}
      today={today}
      notice={noticeText(notice)}
      overlaps={
        notice === "MI301"
          ? {
              reservations: count(one(params.r)),
              lessons: count(one(params.l)),
            }
          : null
      }
    />
  );
}
