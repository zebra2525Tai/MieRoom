import { RoomsView } from "@/components/screens/rooms-view";
import { defaultPeriodNo, parsePeriodNo } from "@/lib/domain/periods";
import {
  APPLICATION_WINDOW_DAYS,
  checkApplicationDate,
} from "@/lib/domain/reservation-rules";
import { filterRooms, type RoomKind } from "@/lib/domain/room-status";
import {
  addDays,
  fiscalYearOfDate,
  isSchoolDate,
  schoolMinutes,
  schoolToday,
} from "@/lib/domain/school-date";
import {
  listClassesForYear,
  listSchoolClosures,
  loadRoomRows,
} from "@/lib/server/queries/common";
import { requireUser } from "@/lib/server/session";
import { one } from "@/lib/url";

// S04 空き教室
export default async function RoomsPage({ searchParams }: PageProps<"/rooms">) {
  await requireUser();
  const params = await searchParams;
  const now = new Date();
  const today = schoolToday(now);
  const requestedDate = one(params.date);
  // 今日〜30日先 (S04).
  const date =
    isSchoolDate(requestedDate) &&
    requestedDate >= today &&
    requestedDate <= addDays(today, APPLICATION_WINDOW_DAYS)
      ? requestedDate
      : today;
  const periodNo =
    parsePeriodNo(one(params.period)) ?? defaultPeriodNo(schoolMinutes(now));
  const requestedKind = one(params.kind);
  const kind: RoomKind | null =
    requestedKind === "HOMEROOM" || requestedKind === "FREE"
      ? requestedKind
      : null;
  const onlyFree = one(params.all) !== "1";

  const [rooms, classes, closures] = await Promise.all([
    loadRoomRows(),
    listClassesForYear(fiscalYearOfDate(date)),
    // Far enough back to step over the summer holidays when looking for 営業日.
    listSchoolClosures(addDays(date, -60), date),
  ]);
  const buildings = [
    ...new Set(rooms.flatMap((room) => (room.building ? [room.building] : []))),
  ];
  const requestedBuilding = one(params.building);
  const building = buildings.find((item) => item === requestedBuilding) ?? null;

  return (
    <RoomsView
      date={date}
      today={today}
      periodNo={periodNo}
      onlyFree={onlyFree}
      kind={kind}
      building={building}
      layout={one(params.layout) === "table" ? "table" : "cards"}
      rooms={filterRooms(rooms, { periodNo, onlyFree, kind, building })}
      buildings={buildings}
      // 取り込みの状況(E12)がまだないので、どのクラスも未入力。
      undecidedClasses={classes.map((item) => item.name)}
      canApply={checkApplicationDate(date, now, closures).ok}
    />
  );
}
