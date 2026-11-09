import type { ReactNode } from "react";
import {
  AccessView,
  ClosuresView,
  DeleteView,
  ExportView,
  LinksView,
  MastersView,
  MonitorsView,
  type LinkTab,
  type MasterData,
  type MasterTab,
} from "@/components/screens/admin-views";
import { BlocksView } from "@/components/screens/blocks-view";
import { HomeView } from "@/components/screens/home-view";
import { ImportView } from "@/components/screens/import-view";
import {
  LessonAddView,
  LessonChangeView,
} from "@/components/screens/lesson-change-view";
import type {
  LessonView,
  TimetableDay,
} from "@/components/screens/lesson-parts";
import { ReservationFormView } from "@/components/screens/reservation-form-view";
import {
  MyReservationsView,
  TeacherHomeView,
  TeacherReservationsView,
  type ReservationRow,
} from "@/components/screens/reservation-lists";
import { RoomsView } from "@/components/screens/rooms-view";
import { TeachersView } from "@/components/screens/teachers-view";
import {
  TimetableView,
  type TimetableMode,
} from "@/components/screens/timetable-view";
import type { Role } from "@/lib/auth/policy";
import { monthWindow } from "@/lib/domain/import-window";
import { MASTER_FILES } from "@/lib/domain/master-csv";
import type { ExportIssue } from "@/lib/domain/master-export";
import {
  defaultPeriodNo,
  parsePeriodNo,
  type PeriodNo,
} from "@/lib/domain/periods";
import { checkApplicationDate } from "@/lib/domain/reservation-rules";
import {
  ALL_FREE,
  filterRooms,
  type RoomKind,
  type RoomRow,
} from "@/lib/domain/room-status";
import {
  addDays,
  addMonths,
  fiscalYearOfDate,
  isSchoolDate,
  mondayOf,
  monthOf,
  monthWeeks,
  schoolMinutes,
  schoolToday,
  weekdayOf,
} from "@/lib/domain/school-date";
import { one } from "@/lib/url";

// Made-up data for looking at each screen without logging in or a database.
// Nothing here is ever shown outside /_dev.

export type SampleParams = Record<string, string | string[] | undefined>;

const CLASSES = [
  { id: "c1", name: "大学併修1年" },
  { id: "c2", name: "医療情報1年" },
  { id: "c3", name: "ゲームITエキスパート1年" },
  { id: "c4", name: "システム専攻2年" },
];

const TEACHER_NAMES = ["岸本", "三和田", "石原", "太田", "高橋", "田村"];
const TEACHERS = TEACHER_NAMES.map((name, index) => ({
  id: `t${index}`,
  name,
}));

function room(
  id: string,
  building: string,
  kind: RoomKind,
  note: string | null,
  slots: Partial<RoomRow["slots"]> = {},
): RoomRow {
  return {
    id,
    name: id,
    building,
    kind,
    note,
    slots: { ...ALL_FREE, ...slots },
  };
}

const ROOMS: RoomRow[] = [
  room("101", "1階", "FREE", "大教室"),
  room("201", "2階", "HOMEROOM", null, {
    1: { kind: "lesson", className: "大学併修1年" },
    2: { kind: "lesson", className: "大学併修1年" },
    3: { kind: "pending" },
  }),
  room("202", "2階", "HOMEROOM", null, {
    3: { kind: "reserved" },
    4: { kind: "reserved" },
  }),
  room("304", "3階", "HOMEROOM", null, {
    3: { kind: "blocked" },
    4: { kind: "blocked" },
    5: { kind: "lesson", className: "ゲームITエキスパート2年" },
    6: { kind: "lesson", className: "ゲームITエキスパート2年" },
  }),
  room("502", "5階", "FREE", "ゼミ室", { 5: { kind: "pending" } }),
  room("504", "5階", "FREE", "講義室"),
  room("601", "6階", "FREE", "PC教室", {
    3: { kind: "lesson", className: "システム専攻2年" },
    4: { kind: "lesson", className: "システム専攻2年" },
  }),
  room("602", "6階", "FREE", "PC教室"),
];

function lesson(
  date: string,
  periodNo: PeriodNo,
  subject: string,
  teachers: string[],
  roomName: string | null,
  extra: Partial<LessonView> = {},
): LessonView {
  return {
    id: `${date}-${periodNo}`,
    date,
    periodNo,
    subject,
    teachers,
    room: roomName,
    cancelled: false,
    extra: false,
    previousRoom: null,
    previousTeachers: null,
    ...extra,
  };
}

function lessonsOf(date: string): LessonView[] {
  const weekday = weekdayOf(date);
  if (weekday === 0 || weekday === 6) return [];
  if (weekday % 2 === 1) {
    return [
      lesson(date, 1, "情報リテラシー", ["三和田"], "201"),
      lesson(date, 2, "プログラミング基礎", ["岸本"], "601", {
        previousRoom: "602",
      }),
      lesson(date, 3, "英語A", ["太田"], "201", {
        previousTeachers: ["石原"],
      }),
      lesson(date, 4, "数学基礎", ["太田"], "201", { cancelled: true }),
    ];
  }
  return [
    lesson(date, 1, "コンピュータ概論", ["高橋"], "201"),
    lesson(date, 2, "キャリアデザイン", [], null),
    lesson(date, 3, "日本語表現", ["田村"], "201"),
    lesson(date, 4, "プログラミング基礎", ["岸本"], "602", { extra: true }),
  ];
}

function dayOf(date: string, today: string): TimetableDay {
  // 来月より先は未定、という形にしておく。
  const entered = date < `${addMonths(monthOf(today), 2)}-01`;
  const weekday = weekdayOf(date);
  return {
    date,
    entered,
    closures: weekday === 3 && entered ? ["防災訓練"] : [],
    lessons: entered ? lessonsOf(date) : [],
  };
}

function reservationRows(today: string): ReservationRow[] {
  const base = {
    note: "",
    proxy: false,
    handledBy: null,
    handledText: null,
    warnings: [],
    blockedReasons: [],
  };
  return [
    {
      ...base,
      id: "r1",
      dateText: "11/20(金)",
      slotText: "3限前半〜4限後半(13:30-16:45)",
      room: "504",
      purpose: "自習",
      note: "卒業制作の打合せ",
      applicant: "山田 花子",
      createdText: `${today.slice(5).replace("-", "/")} 09:30`,
      status: "pending",
      warnings: ["同じ枠に、ほかの承認待ちの申請があります(1件)。"],
    },
    {
      ...base,
      id: "r2",
      dateText: "11/24(火)",
      slotText: "2限後半(11:45-12:30)",
      room: "202",
      purpose: "就活",
      applicant: "佐藤 太郎",
      createdText: "11/05 10:12",
      status: "pending",
      blockedReasons: [
        "時間割が未定のクラスがあるため、承認できません(未入力: 医療情報1年)。",
      ],
    },
    {
      ...base,
      id: "r3",
      dateText: "11/19(木)",
      slotText: "1限前半(9:15-10:00)",
      room: "101",
      purpose: "その他",
      applicant: "鈴木 一郎",
      createdText: "11/04 16:40",
      status: "approved",
      handledBy: "岸本",
      handledText: "11/05 09:00",
    },
    {
      ...base,
      id: "r4",
      dateText: "11/18(水)",
      slotText: "4限後半(16:00-16:45)",
      room: "602",
      purpose: "自習",
      applicant: "岸本",
      createdText: "11/04 12:00",
      status: "approved",
      proxy: true,
      handledBy: "岸本",
      handledText: "11/04 12:00",
    },
    {
      ...base,
      id: "r5",
      dateText: "11/17(火)",
      slotText: "2限前半(11:00-11:45)",
      room: "503",
      purpose: "自習",
      applicant: "山田 花子",
      createdText: "11/02 11:00",
      status: "rejected",
      handledBy: "田村",
      handledText: "11/03 10:00",
    },
  ];
}

const MASTER_DATA: Record<MasterTab, MasterData> = {
  classes: {
    tab: "classes",
    rows: CLASSES.map((item, index) => ({
      id: item.id,
      name: item.name,
      homeRoom: ["201", "202", "203", "305"][index],
      homeRoomId: ["201", "202", "203", "305"][index],
      startYear: 2026,
      endYear: null,
      active: true,
      version: "2026-11-01T00:00:00.000Z",
    })),
  },
  teachers: {
    tab: "teachers",
    rows: TEACHERS.map((item, index) => ({
      id: item.id,
      name: item.name,
      email: null,
      tagId: index === 5 ? "12" : null,
      active: index !== 3,
      version: "2026-11-01T00:00:00.000Z",
    })),
  },
  subjects: {
    tab: "subjects",
    rows: [
      {
        id: "s1",
        name: "英語A",
        active: true,
        version: "2026-11-01T00:00:00.000Z",
      },
      {
        id: "s2",
        name: "情報リテラシー",
        active: true,
        version: "2026-11-01T00:00:00.000Z",
      },
      {
        id: "s3",
        name: "プログラミング基礎",
        active: true,
        version: "2026-11-01T00:00:00.000Z",
      },
    ],
  },
  rooms: {
    tab: "rooms",
    rows: ROOMS.map((item) => ({
      id: item.id,
      name: item.name,
      building: item.building,
      kind: item.kind,
      note: item.note,
      receivers: item.id === "304" ? ["304"] : [],
      active: true,
      version: "2026-11-01T00:00:00.000Z",
    })),
  },
};

export type Sample = {
  /** The menu item to light up. */
  menuId: string;
  /** Without the frame: the screen is the whole page. */
  bare?: boolean;
  element: ReactNode;
};

const EXPORT_ISSUES: ExportIssue[] = [
  {
    level: "error",
    check: 3,
    message: "「数学基礎」に、講師の行がありません(「各担当」でもよい)",
    target: "大学併修1年",
    fixPath: "/admin/links?tab=teachers",
  },
  {
    level: "error",
    check: 2,
    message:
      "ホームルーム教室「201」が、同じ年度の複数のクラスで重なっています",
    target: "システム専攻1年、大学併修1年",
    fixPath: "/admin/masters/classes",
  },
  {
    level: "warning",
    check: 6,
    message:
      "休み・行事が180行を超えています(185行)。ツールの上限は、担任が手で足した行も含めて200行です。",
    target: "休み・行事.csv",
    fixPath: "/admin/closures",
  },
];

/** The sample of a screen: "s03", or "s21/teachers" for a tab. */
export function sampleFor(
  path: string[],
  params: SampleParams,
  role: Role,
): Sample | null {
  const now = new Date();
  const today = schoolToday(now);
  const minutes = schoolMinutes(now);
  const year = fiscalYearOfDate(today);
  const screen = path[0];
  const base = `/_dev/${screen}`;

  switch (screen) {
    case "s02": {
      const selected = CLASSES.find((item) => item.id === one(params.class));
      return {
        menuId: "s02",
        element: (
          <HomeView
            today={today}
            classes={CLASSES}
            selectedClassId={selected?.id ?? null}
            todayFiscalYear={year}
            yearChanged={one(params.notice) === "year-changed"}
            lessons={
              one(params.undecided) === "1"
                ? { kind: "undecided" }
                : {
                    kind: "ready",
                    current: lesson(
                      today,
                      1,
                      "情報リテラシー",
                      ["三和田"],
                      "201",
                    ),
                    next: lesson(
                      today,
                      2,
                      "プログラミング基礎",
                      ["岸本"],
                      "601",
                      {
                        previousRoom: "602",
                      },
                    ),
                  }
            }
            closures={["防災訓練"]}
          />
        ),
      };
    }
    case "s03": {
      const requestedDate = one(params.date);
      const date = isSchoolDate(requestedDate) ? requestedDate : today;
      const view = one(params.view);
      const mode: TimetableMode =
        view === "week" || view === "month" ? view : "day";
      const dates =
        mode === "day"
          ? [date]
          : mode === "week"
            ? [0, 1, 2, 3, 4].map((offset) => addDays(mondayOf(date), offset))
            : monthWeeks(monthOf(date)).flat();
      const teacher = TEACHERS.find((item) => item.id === one(params.teacher));
      return {
        menuId: "s03",
        element: (
          <TimetableView
            mode={mode}
            date={date}
            today={today}
            minutes={minutes}
            days={dates.map((item) => dayOf(item, today))}
            classes={CLASSES}
            selectedClassId={
              teacher
                ? null
                : (CLASSES.find((item) => item.id === one(params.class))?.id ??
                  CLASSES[0].id)
            }
            todayFiscalYear={year}
            teachers={TEACHERS}
            selectedTeacherId={teacher?.id ?? null}
            canChange={role !== "student"}
            basePath={base}
            changeBasePath="/_dev/s14"
            addHref={`/_dev/s14-add?role=${role}`}
          />
        ),
      };
    }
    case "s04": {
      const requestedDate = one(params.date);
      const date = isSchoolDate(requestedDate) ? requestedDate : today;
      const periodNo =
        parsePeriodNo(one(params.period)) ?? defaultPeriodNo(minutes);
      const requestedKind = one(params.kind);
      const kind: RoomKind | null =
        requestedKind === "HOMEROOM" || requestedKind === "FREE"
          ? requestedKind
          : null;
      const onlyFree = one(params.all) !== "1";
      const buildings = [...new Set(ROOMS.map((item) => item.building ?? ""))];
      const building =
        buildings.find((item) => item === one(params.building)) ?? null;
      return {
        menuId: "s04",
        element: (
          <RoomsView
            date={date}
            today={today}
            periodNo={periodNo}
            onlyFree={onlyFree}
            kind={kind}
            building={building}
            layout={one(params.layout) === "table" ? "table" : "cards"}
            rooms={filterRooms(ROOMS, { periodNo, onlyFree, kind, building })}
            buildings={buildings}
            undecidedClasses={["医療情報1年"]}
            canApply={checkApplicationDate(date, now, []).ok}
            basePath={base}
          />
        ),
      };
    }
    case "s05": {
      const query = (one(params.q) ?? "").trim();
      const rows = [
        {
          id: "t5",
          name: "田村",
          location: { kind: "room", room: "304" } as const,
          assignments: [
            {
              className: "システム専攻2年",
              subject: "チーム開発演習",
              rooms: ["601"],
            },
            {
              className: "医療情報2年",
              subject: "診療情報管理",
              rooms: ["303"],
            },
          ],
        },
        {
          id: "t4",
          name: "高橋",
          location: { kind: "out-of-area" } as const,
          assignments: [
            {
              className: "大学併修3年",
              subject: "システム設計演習",
              rooms: ["603"],
            },
          ],
        },
        {
          id: "t0",
          name: "岸本",
          location: { kind: "no-tag" } as const,
          assignments: [
            {
              className: "大学併修1年",
              subject: "プログラミング基礎",
              rooms: ["601"],
            },
          ],
        },
        {
          id: "t3",
          name: "太田",
          location: { kind: "no-tag" } as const,
          assignments: [],
        },
      ];
      return {
        menuId: "s05",
        element: (
          <TeachersView
            teachers={rows.filter((row) => row.name.includes(query))}
            query={query}
            basePath={base}
          />
        ),
      };
    }
    case "s06":
    case "s12": {
      const requestedDate = one(params.date);
      const date = isSchoolDate(requestedDate)
        ? requestedDate
        : addDays(today, 7);
      return {
        menuId: screen,
        element: (
          <ReservationFormView
            mode={screen === "s06" ? "apply" : "proxy"}
            rooms={ROOMS}
            roomId={
              ROOMS.find((item) => item.id === one(params.room))?.id ?? "201"
            }
            date={date}
            today={today}
            periodNo={parsePeriodNo(one(params.period)) ?? 2}
            check={checkApplicationDate(date, now, [])}
            basePath={base}
          />
        ),
      };
    }
    case "s07":
      return {
        menuId: "s07",
        element: (
          <MyReservationsView
            rows={reservationRows(today)}
            page={1}
            hasNext={false}
          />
        ),
      };
    case "s10":
      return {
        menuId: "s10",
        element: (
          <TeacherHomeView
            total={1}
            page={1}
            hasNext={false}
            rows={reservationRows(today).filter(
              (row) => row.status === "pending",
            )}
          />
        ),
      };
    case "s11":
      return {
        menuId: "s11",
        element: (
          <TeacherReservationsView
            rows={reservationRows(today)}
            page={1}
            hasNext={false}
            rooms={ROOMS}
            status={one(params.status) ?? ""}
            roomId={one(params.room) ?? ""}
            start={one(params.start) ?? today}
            end={one(params.end) ?? addDays(today, 30)}
            basePath={base}
          />
        ),
      };
    case "s13":
      return {
        menuId: "s13",
        element: (
          <BlocksView
            today={today}
            rooms={ROOMS}
            rows={[
              {
                id: "b1",
                roomId: "r304",
                room: "304",
                rangeText: "11/20(金) 2限 〜 11/20(金) 4限",
                setBy: "田村",
                setText: "11/05 09:10",
                overlapReservations: 1,
                overlapLessons: 2,
              },
            ]}
          />
        ),
      };
    case "s14":
      return {
        menuId: "s03",
        element: (
          <LessonChangeView
            lesson={lesson(today, 2, "プログラミング基礎", ["岸本"], "601", {
              previousRoom: "602",
              previousTeachers: ["石原"],
            })}
            className="大学併修1年"
            today={today}
            backHref="/_dev/s03"
            rooms={ROOMS.map((item) => ({
              id: item.id,
              name: item.name,
              status: item.slots[3],
            }))}
            teachers={TEACHERS.map((item, index) => ({
              ...item,
              busy: index === 1,
            }))}
          />
        ),
      };
    case "s14-add":
      return {
        menuId: "s03",
        element: (
          <LessonAddView
            className="大学併修1年"
            date={addDays(today, 1)}
            backHref="/_dev/s03"
            subjects={[
              { id: "s1", name: "英語A" },
              { id: "s2", name: "情報リテラシー" },
            ]}
            rooms={ROOMS}
            teachers={TEACHERS}
          />
        ),
      };
    case "s20": {
      const months: [string, string] = [
        monthOf(today),
        addMonths(monthOf(today), 1),
      ];
      return {
        menuId: "s20",
        element: (
          <ImportView
            months={months}
            windows={[
              monthWindow(today, months[0]),
              monthWindow(today, months[1]),
            ]}
            rows={[
              {
                id: "c1",
                name: "大学併修1年",
                cells: [
                  {
                    imported: "done",
                    importedText: "10/25 14:02",
                    changedLessons: 3,
                  },
                  { imported: "provisional" },
                ],
              },
              {
                id: "c2",
                name: "医療情報1年",
                cells: [
                  { imported: "done", importedText: "10/25 14:02" },
                  { imported: "none" },
                ],
              },
              {
                id: "c3",
                name: "ゲームITエキスパート1年",
                cells: [{ imported: "none" }, { imported: "none" }],
              },
            ]}
          />
        ),
      };
    }
    case "s21": {
      const tab = path[1];
      const data =
        tab === "teachers" || tab === "subjects" || tab === "rooms"
          ? MASTER_DATA[tab]
          : MASTER_DATA.classes;
      return {
        menuId: "s21",
        element: (
          <MastersView
            defaultYear={2026}
            data={data}
            showInactive={one(params.inactive) === "1"}
            basePath={base}
          />
        ),
      };
    }
    case "s22": {
      const requested = one(params.tab);
      const tab: LinkTab =
        requested === "teachers" || requested === "rooms"
          ? requested
          : "subjects";
      return {
        menuId: "s22",
        element: (
          <LinksView
            tab={tab}
            classes={CLASSES}
            classId={one(params.class) ?? "c1"}
            rows={[
              {
                key: "a",
                subjectId: "s1",
                targetKey: "t1",
                subject: "英語A",
                value: tab === "rooms" ? "201" : "石原",
              },
              {
                key: "b",
                subjectId: "s2",
                targetKey: "each",
                subject: "キャリアデザイン",
                value: tab === "rooms" ? "ー(教室未定)" : "各担当",
              },
              {
                key: "c",
                subjectId: "s3",
                targetKey: "t2",
                subject: "日本語表現",
                value: "島田",
                missing: true,
              },
            ]}
            choices={{
              newSubjects: [],
              classSubjects: [{ id: "s1", name: "英語A" }],
              teachers: [{ id: "t1", name: "石原" }],
              rooms: [{ id: "r1", name: "201" }],
            }}
            basePath={base}
          />
        ),
      };
    }
    case "s23":
      return {
        menuId: "s23",
        element: (
          <ClosuresView
            year={year}
            years={[year - 1, year, year + 1]}
            hasSchoolClosure
            classes={CLASSES}
            basePath={base}
            rows={[
              {
                id: "1",
                editable: true,
                startDate: "2026-11-03",
                endDate: null,
                classId: null,
                version: "2026-11-01T00:00:00.000Z",
                startText: "11/3(火)",
                endText: "—",
                name: "文化の日",
                target: "全校",
                source: "システム",
              },
              {
                id: "2",
                editable: true,
                startDate: "2026-11-12",
                endDate: "2026-11-13",
                classId: null,
                version: "2026-11-01T00:00:00.000Z",
                startText: "11/12(木)",
                endText: "11/13(金)",
                name: "学園祭",
                target: "全校",
                source: "システム",
              },
              {
                id: "3",
                editable: false,
                startDate: "2026-11-20",
                endDate: null,
                classId: null,
                version: "2026-11-01T00:00:00.000Z",
                startText: "11/20(金)",
                endText: "—",
                name: "校外学習",
                target: "大学併修1年",
                source: "ツール(大学併修1年・2026年11月)",
              },
            ]}
          />
        ),
      };
    case "s24":
    case "s24-error":
      return {
        menuId: "s24",
        element: (
          <ExportView
            yearLabel={`今年度(${year}年度)`}
            files={Object.values(MASTER_FILES).map((name, index) => ({
              name,
              rows: [12, 20, 52, 21, 74, 76, 74, 29][index],
            }))}
            issues={screen === "s24" ? [] : EXPORT_ISSUES}
          />
        ),
      };
    case "s25":
      return {
        menuId: "s25",
        element: (
          <AccessView
            receivers={[{ id: "1", receiverId: "304", room: "304" }]}
            teachers={TEACHERS.map((item, index) => ({
              ...item,
              tagId: index === 5 ? "12" : null,
              active: true,
            }))}
            rooms={ROOMS.map((room) => ({ id: room.id, name: room.name }))}
          />
        ),
      };
    case "s26":
      return { menuId: "s26", element: <DeleteView /> };
    case "s27":
      return { menuId: "s27", element: <MonitorsView /> };
    default:
      return null;
  }
}
