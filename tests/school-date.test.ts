import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  fiscalYearOfDate,
  formatDate,
  formatLongDate,
  isSchoolDate,
  mondayOf,
  monthWeeks,
  parseWeekStart,
  schoolMinutes,
  schoolToday,
  weekDates,
  weekdayHeaders,
  weekdayOf,
  weekStartOf,
} from "@/lib/domain/school-date";

// The tests run in UTC (vitest.config.mts), so these also prove the answers do not
// depend on the server's own time zone.
describe("schoolToday / schoolMinutes", () => {
  it("日本時間の日付を返す(UTCではまだ前の日でも)", () => {
    expect(schoolToday(new Date("2026-11-04T14:59:59Z"))).toBe("2026-11-04");
    expect(schoolToday(new Date("2026-11-04T15:00:00Z"))).toBe("2026-11-05");
  });

  it("年またぎ", () => {
    expect(schoolToday(new Date("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
  });

  it("日本時間の0時からの分を返す", () => {
    expect(schoolMinutes(new Date("2026-11-05T00:15:00Z"))).toBe(9 * 60 + 15);
  });
});

describe("isSchoolDate", () => {
  it("実在する日付だけを通す", () => {
    expect(isSchoolDate("2026-11-05")).toBe(true);
    expect(isSchoolDate("2028-02-29")).toBe(true);
    expect(isSchoolDate("2026-02-30")).toBe(false);
    expect(isSchoolDate("2026/11/05")).toBe(false);
    expect(isSchoolDate("2026-11-5")).toBe(false);
    expect(isSchoolDate(undefined)).toBe(false);
  });
});

describe("日付の計算", () => {
  it("月・年をまたいで足し引きできる", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2027-01", -1)).toBe("2026-12");
  });

  it("曜日と週の月曜", () => {
    expect(weekdayOf("2026-11-05")).toBe(4); // 木曜
    expect(mondayOf("2026-11-05")).toBe("2026-11-02");
    expect(mondayOf("2026-11-02")).toBe("2026-11-02");
    expect(mondayOf("2026-11-08")).toBe("2026-11-02"); // 日曜は前の月曜の週
  });

  it("月の週: 月曜始まりで、月全体を覆う", () => {
    const weeks = monthWeeks("2026-11");
    expect(weeks[0][0]).toBe("2026-10-26");
    expect(weeks[weeks.length - 1][6]).toBe("2026-12-06");
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks.flat()).toContain("2026-11-30");
  });
});

describe("週の始まり (S03 の月曜始まり/日曜始まり)", () => {
  it("sun だけが日曜。ほかは月曜", () => {
    expect(parseWeekStart("sun")).toBe("sun");
    expect(parseWeekStart("mon")).toBe("mon");
    expect(parseWeekStart(undefined)).toBe("mon");
    expect(parseWeekStart("SUN")).toBe("mon");
    expect(parseWeekStart(["sun"])).toBe("mon");
  });

  it("週の最初の日: 日曜始まりでは、日曜はその週の最初", () => {
    expect(weekStartOf("2026-11-05")).toBe("2026-11-02"); // 木曜 → 月曜
    expect(weekStartOf("2026-11-08", "mon")).toBe("2026-11-02"); // 日曜 → 前の月曜
    expect(weekStartOf("2026-11-05", "sun")).toBe("2026-11-01"); // 木曜 → 日曜
    expect(weekStartOf("2026-11-08", "sun")).toBe("2026-11-08"); // 日曜はその日
    expect(weekStartOf("2026-11-07", "sun")).toBe("2026-11-01"); // 土曜 → 前の日曜
    expect(weekStartOf("2027-01-02", "sun")).toBe("2026-12-27"); // 年をまたぐ
  });

  it("曜日の見出し", () => {
    expect(weekdayHeaders()).toEqual([
      "月",
      "火",
      "水",
      "木",
      "金",
      "土",
      "日",
    ]);
    expect(weekdayHeaders("sun")).toEqual([
      "日",
      "月",
      "火",
      "水",
      "木",
      "金",
      "土",
    ]);
  });

  it("週の日付: 月曜始まりは月〜土、日曜始まりは日〜土", () => {
    expect(weekDates("2026-11-05")).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
    ]);
    expect(weekDates("2026-11-08", "sun")).toEqual([
      "2026-11-08",
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
    ]);
  });

  it("月の週: 日曜始まりでも7日ずつで、月全体を覆う", () => {
    const weeks = monthWeeks("2026-11", "sun");
    expect(weeks[0][0]).toBe("2026-11-01"); // 11/1 は日曜
    expect(weeks[weeks.length - 1][6]).toBe("2026-12-05"); // 土曜で終わる
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks.every((week) => weekdayOf(week[0]) === 0)).toBe(true);
    expect(weeks.flat()).toContain("2026-11-30");
    // 1日が土曜の月: 前の月の日曜から始まる
    expect(monthWeeks("2026-08", "sun")[0][0]).toBe("2026-07-26");
  });
});

describe("fiscalYearOfDate (R2-2)", () => {
  it("4月からが新しい年度", () => {
    expect(fiscalYearOfDate("2027-03-31")).toBe(2026);
    expect(fiscalYearOfDate("2027-04-01")).toBe(2027);
  });
});

describe("表示の形式 (6-1)", () => {
  it("今年の日付は年を省く", () => {
    expect(formatDate("2026-11-20", "2026-11-05")).toBe("11/20(金)");
    expect(formatDate("2027-01-04", "2026-11-05")).toBe("2027/1/4(月)");
  });

  it("年つき", () => {
    expect(formatLongDate("2026-11-20")).toBe("2026/11/20(金)");
  });
});
