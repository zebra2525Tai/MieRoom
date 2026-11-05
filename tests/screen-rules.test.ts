import { describe, expect, it } from "vitest";
import { closureNamesOn } from "@/lib/domain/closures";
import { monthWindow } from "@/lib/domain/import-window";
import {
  defaultPeriodNo,
  parsePeriodNo,
  periodAt,
  SLOTS,
  slotsOfPeriod,
  toMinutes,
} from "@/lib/domain/periods";
import {
  checkApplicationDate,
  isBusinessDay,
  previousBusinessDay,
} from "@/lib/domain/reservation-rules";
import {
  ALL_FREE,
  filterRooms,
  slotStatusLabel,
  type RoomRow,
} from "@/lib/domain/room-status";
import { activeItem, menuFor } from "@/lib/nav";
import { withQuery } from "@/lib/url";

describe("時限と枠 (R3-1)", () => {
  it("4つの時限と8つの枠", () => {
    expect(SLOTS).toHaveLength(8);
    expect(SLOTS.map((slot) => slot.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(SLOTS[0]).toMatchObject({
      label: "1限前半",
      start: "9:15",
      end: "10:00",
    });
    expect(SLOTS[7]).toMatchObject({
      label: "4限後半",
      start: "16:00",
      end: "16:45",
    });
    expect(slotsOfPeriod(2).map((slot) => slot.label)).toEqual([
      "2限前半",
      "2限後半",
    ]);
  });

  it("いまの時限: 終わりの時刻ちょうどは含まない", () => {
    expect(periodAt(toMinutes("9:14"))).toBeNull();
    expect(periodAt(toMinutes("9:15"))?.no).toBe(1);
    expect(periodAt(toMinutes("10:44"))?.no).toBe(1);
    expect(periodAt(toMinutes("10:45"))).toBeNull();
    expect(periodAt(toMinutes("12:45"))).toBeNull();
  });

  it("S04の初期の時限: 時限の外なら次、4限のあとは1限", () => {
    expect(defaultPeriodNo(toMinutes("8:00"))).toBe(1);
    expect(defaultPeriodNo(toMinutes("10:00"))).toBe(1);
    expect(defaultPeriodNo(toMinutes("10:50"))).toBe(2);
    expect(defaultPeriodNo(toMinutes("12:45"))).toBe(3);
    expect(defaultPeriodNo(toMinutes("16:44"))).toBe(4);
    expect(defaultPeriodNo(toMinutes("16:45"))).toBe(1);
  });

  it("時限の値の検証", () => {
    expect(parsePeriodNo("3")).toBe(3);
    expect(parsePeriodNo("5")).toBeNull();
    expect(parsePeriodNo("abc")).toBeNull();
    expect(parsePeriodNo(undefined)).toBeNull();
  });
});

describe("営業日と申請の締め切り (R4-2, R4-3)", () => {
  const holiday = { startDate: "2026-11-23", endDate: null }; // 月曜の祝日
  const festival = { startDate: "2026-11-12", endDate: "2026-11-13" };
  const jst = (date: string, time: string) =>
    new Date(`${date}T${time}:00+09:00`);

  it("土日と全校の休み・行事は営業日ではない", () => {
    expect(isBusinessDay("2026-11-20", [holiday])).toBe(true);
    expect(isBusinessDay("2026-11-21", [holiday])).toBe(false);
    expect(isBusinessDay("2026-11-22", [holiday])).toBe(false);
    expect(isBusinessDay("2026-11-23", [holiday])).toBe(false);
    expect(isBusinessDay("2026-11-13", [festival])).toBe(false);
  });

  it("月曜の枠は前の金曜。祝日のあとの火曜も前の金曜", () => {
    expect(previousBusinessDay("2026-11-16", [])).toBe("2026-11-13");
    expect(previousBusinessDay("2026-11-24", [holiday])).toBe("2026-11-20");
  });

  it("締め切りは前の営業日の12:00ちょうどまで(12:00は過ぎている)", () => {
    const date = "2026-11-16"; // 月曜。締め切りは金曜 11/13 12:00
    expect(checkApplicationDate(date, jst("2026-11-13", "11:59"), []).ok).toBe(
      true,
    );
    expect(
      checkApplicationDate(date, jst("2026-11-13", "12:00"), []),
    ).toMatchObject({ ok: false, code: "ME101" });
  });

  it("当日は必ず締め切りを過ぎている", () => {
    expect(
      checkApplicationDate("2026-11-16", jst("2026-11-16", "08:00"), []),
    ).toMatchObject({ ok: false, code: "ME101" });
  });

  it("過ぎた枠はME103、30日先を超えるとME102", () => {
    const now = jst("2026-11-05", "09:00");
    expect(checkApplicationDate("2026-11-04", now, [])).toMatchObject({
      ok: false,
      code: "ME103",
    });
    expect(checkApplicationDate("2026-12-05", now, []).ok).toBe(true);
    expect(checkApplicationDate("2026-12-06", now, [])).toMatchObject({
      ok: false,
      code: "ME102",
    });
  });

  it("日付が変わる前後も、日本時間で判定する", () => {
    // UTCでは 11/12 だが、日本時間では 11/13 の 8:59
    expect(
      checkApplicationDate("2026-11-16", new Date("2026-11-12T23:59:00Z"), [])
        .ok,
    ).toBe(true);
  });
});

describe("取り込める月 (R3-3, R3-5)", () => {
  it("当月は25日まで。26日の0時から締め", () => {
    expect(monthWindow("2026-11-25", "2026-11")).toBe("open");
    expect(monthWindow("2026-11-26", "2026-11")).toBe("closed");
  });

  it("翌月は締まらない。過去の月は不可", () => {
    expect(monthWindow("2026-11-26", "2026-12")).toBe("open");
    expect(monthWindow("2026-11-05", "2026-10")).toBe("past");
  });

  it("新しい年度の月は、4/1まで取り込めない", () => {
    expect(monthWindow("2027-03-10", "2027-04")).toBe("not-yet");
    expect(monthWindow("2027-02-10", "2027-05")).toBe("not-yet");
    expect(monthWindow("2027-04-01", "2027-04")).toBe("open");
  });
});

describe("休み・行事の名前", () => {
  const closures = [
    { startDate: "2026-11-12", endDate: "2026-11-13", name: "学園祭" },
    { startDate: "2026-11-13", endDate: null, name: "学園祭" },
    { startDate: "2026-11-13", endDate: null, name: "校外学習" },
  ];

  it("期間に入る日だけ。同じ名前は1回", () => {
    expect(closureNamesOn("2026-11-13", closures)).toEqual([
      "学園祭",
      "校外学習",
    ]);
    expect(closureNamesOn("2026-11-12", closures)).toEqual(["学園祭"]);
    expect(closureNamesOn("2026-11-14", closures)).toEqual([]);
  });
});

describe("空き教室の絞り込み (S04)", () => {
  const room = (name: string, slots: Partial<RoomRow["slots"]>): RoomRow => ({
    id: name,
    name,
    building: name.startsWith("2") ? "2階" : "6階",
    kind: name.startsWith("2") ? "HOMEROOM" : "FREE",
    note: null,
    slots: { ...ALL_FREE, ...slots },
  });
  const lesson = { kind: "lesson", className: "A" } as const;
  const rooms = [
    room("201", { 1: lesson, 2: lesson }),
    room("202", { 1: lesson, 2: { kind: "pending" } }),
    room("601", { 1: { kind: "blocked" }, 2: { kind: "reserved" } }),
    room("602", {}),
  ];
  const names = (filter: Parameters<typeof filterRooms>[1]) =>
    filterRooms(rooms, filter).map((item) => item.name);

  it("空きだけ: 前半か後半が空きか仮予約あり", () => {
    expect(
      names({ periodNo: 1, onlyFree: true, kind: null, building: null }),
    ).toEqual(["202", "602"]);
  });

  it("すべて・分類・フロア", () => {
    expect(
      names({ periodNo: 1, onlyFree: false, kind: null, building: null }),
    ).toHaveLength(4);
    expect(
      names({ periodNo: 1, onlyFree: false, kind: "FREE", building: null }),
    ).toEqual(["601", "602"]);
    expect(
      names({ periodNo: 1, onlyFree: false, kind: null, building: "2階" }),
    ).toEqual(["201", "202"]);
  });

  it("状態の表示名", () => {
    expect(slotStatusLabel({ kind: "free" })).toBe("空き");
    expect(slotStatusLabel({ kind: "pending" })).toBe("仮予約あり");
    expect(slotStatusLabel({ kind: "reserved" })).toBe("予約済み");
    expect(slotStatusLabel({ kind: "blocked" })).toBe("使用止め");
    expect(slotStatusLabel(lesson)).toBe("授業(A)");
  });
});

describe("メニュー (5-3)", () => {
  const ids = (role: Parameters<typeof menuFor>[0]) =>
    menuFor(role).flatMap((section) => section.items.map((item) => item.id));

  it("学生には、先生・管理の項目を出さない", () => {
    expect(ids("student")).toEqual(["s02", "s03", "s04", "s05", "s06", "s07"]);
  });

  it("先生には、管理の項目を出さない", () => {
    expect(ids("teacher")).toContain("s13");
    expect(ids("teacher")).not.toContain("s20");
  });

  it("時間割管理者には、すべて出す", () => {
    expect(ids("admin")).toContain("s10");
    expect(ids("admin")).toContain("s27");
  });

  it("いまの画面: いちばん長く一致する項目", () => {
    expect(activeItem("/")?.id).toBe("s02");
    expect(activeItem("/reservations")?.id).toBe("s07");
    expect(activeItem("/reservations/new")?.id).toBe("s06");
    expect(activeItem("/teacher")?.id).toBe("s10");
    expect(activeItem("/teacher/reservations/new")?.id).toBe("s12");
    expect(activeItem("/admin/masters/rooms")?.id).toBe("s21");
    expect(activeItem("/teachers")?.id).toBe("s05");
    expect(activeItem("/unknown")).toBeNull();
  });
});

describe("withQuery", () => {
  it("空の値は入れない", () => {
    expect(withQuery("/a", { x: 1, y: null, z: "", w: undefined })).toBe(
      "/a?x=1",
    );
    expect(withQuery("/a", {})).toBe("/a");
  });

  it("値を逃がす", () => {
    expect(withQuery("/a", { q: "a b&c" })).toBe("/a?q=a+b%26c");
  });
});
