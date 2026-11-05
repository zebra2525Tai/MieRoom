import { describe, expect, it } from "vitest";
import { fiscalYear } from "@/lib/domain/fiscal-year";

// The tests run in UTC (vitest.config.mts), so these also prove the answer does
// not depend on the server's own time zone.
describe("fiscalYear (R2-2)", () => {
  it("4月〜12月はその年、1月〜3月は前の年", () => {
    expect(fiscalYear(new Date("2026-04-15T03:00:00Z"))).toBe(2026);
    expect(fiscalYear(new Date("2026-12-15T03:00:00Z"))).toBe(2026);
    expect(fiscalYear(new Date("2027-01-15T03:00:00Z"))).toBe(2026);
    expect(fiscalYear(new Date("2027-03-10T03:00:00Z"))).toBe(2026); // 例: 2027/3/10 は2026年度
  });

  it("年度の替わり目は日本時間の4/1 0:00", () => {
    // 2026-03-31 14:59:59Z = 日本時間 3/31 23:59:59 (まだ前の年度)
    expect(fiscalYear(new Date("2026-03-31T14:59:59Z"))).toBe(2025);
    // 2026-03-31 15:00:00Z = 日本時間 4/1 0:00 (新しい年度)
    expect(fiscalYear(new Date("2026-03-31T15:00:00Z"))).toBe(2026);
  });

  it("元日の0:00 (日本時間) は、UTCではまだ前の年でも、同じ年度のまま", () => {
    expect(fiscalYear(new Date("2026-12-31T14:59:59Z"))).toBe(2026);
    expect(fiscalYear(new Date("2026-12-31T15:00:00Z"))).toBe(2026);
  });
});
