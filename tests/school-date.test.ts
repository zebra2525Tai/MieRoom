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
  schoolMinutes,
  schoolToday,
  weekdayOf,
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
