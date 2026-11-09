import { describe, expect, it } from "vitest";
import {
  approvalWarnings,
  blockCovers,
  blockedPeriodsOn,
  blockEndAt,
  canCancel,
  canReject,
  canWithdraw,
  characterCount,
  checkApplication,
  checkApproval,
  checkBlockInput,
  compareByStart,
  effectiveStatus,
  isContinuous,
  lessonInBlock,
  normalizeInput,
  orderMine,
  periodStartAt,
  reservationEndAt,
  reservationInBlock,
  reservationInputSchema,
  reservationStartAt,
  schoolInstant,
  slotRangeText,
  slotStatuses,
  type BlockRange,
} from "@/lib/domain/reservation-core";
import {
  applicationMessage,
  blockerMessage,
  warningMessage,
} from "@/lib/domain/reservation-text";
import { ALL_FREE } from "@/lib/domain/room-status";
import type { SlotNo } from "@/lib/domain/periods";
import type { SchoolClosure } from "@/lib/domain/reservation-rules";
import type { StoredReservationStatus } from "@/lib/domain/reservation-core";

// 2026-11-16 is a Monday. Times are written in UTC; Japan is +9 (12:00 in Japan = 03:00Z).
const at = (iso: string) => new Date(iso);
const NO_CLOSURES: SchoolClosure[] = [];
const LESSON = { kind: "lesson", className: "A組" } as const;

describe("日本時間の瞬間", () => {
  it("枠の開始・終了を、日本時間で求める", () => {
    expect(schoolInstant("2026-11-16", "9:15").toISOString()).toBe(
      "2026-11-16T00:15:00.000Z",
    );
    expect(reservationStartAt("2026-11-16", [5, 6]).toISOString()).toBe(
      "2026-11-16T04:30:00.000Z", // 13:30
    );
    expect(reservationEndAt("2026-11-16", [6, 5]).toISOString()).toBe(
      "2026-11-16T06:00:00.000Z", // 15:00
    );
    expect(periodStartAt("2026-11-16", 4).toISOString()).toBe(
      "2026-11-16T06:15:00.000Z", // 15:15
    );
  });

  it("日付の境目: 日本の0時前後でも日付がずれない", () => {
    expect(schoolInstant("2026-12-31", "9:15").toISOString()).toBe(
      "2026-12-31T00:15:00.000Z",
    );
    expect(schoolInstant("2027-03-31", "16:00").toISOString()).toBe(
      "2027-03-31T07:00:00.000Z",
    );
  });

  it("枠の範囲の表示(6-1)", () => {
    expect(slotRangeText([5, 6])).toBe("3限前半〜3限後半(13:30-15:00)");
    expect(slotRangeText([6, 7, 8])).toBe("3限後半〜4限後半(14:15-16:45)");
    expect(slotRangeText([1])).toBe("1限前半(9:15-10:00)");
  });
});

describe("期限切れは保存せず、読むときに決める (R4-6)", () => {
  const slots: SlotNo[] = [5, 6]; // 3限 13:30 = 04:30Z
  it("承認待ちは、最初の枠が始まる時刻ちょうどから期限切れ", () => {
    expect(
      effectiveStatus(
        "pending",
        "2026-11-16",
        slots,
        at("2026-11-16T04:29:59Z"),
      ),
    ).toBe("pending");
    expect(
      effectiveStatus(
        "pending",
        "2026-11-16",
        slots,
        at("2026-11-16T04:30:00Z"),
      ),
    ).toBe("expired");
  });
  it("承認待ち以外は変わらない", () => {
    for (const status of [
      "approved",
      "rejected",
      "cancelled",
      "withdrawn",
    ] as const) {
      expect(
        effectiveStatus(
          status,
          "2026-11-16",
          slots,
          at("2026-12-01T00:00:00Z"),
        ),
      ).toBe(status);
    }
  });
});

describe("枠の選び方 (R4-4)", () => {
  it("続いた枠だけ。昼休みや休み時間をまたいでもよい", () => {
    expect(isContinuous([1])).toBe(true);
    expect(isContinuous([4, 3])).toBe(true); // 2限後半 と 2限前半
    expect(isContinuous([4, 5])).toBe(true); // 2限後半 と 3限前半(昼休みをまたぐ)
    expect(isContinuous([1, 8])).toBe(false);
    expect(isContinuous([1, 3])).toBe(false);
    expect(isContinuous([])).toBe(false);
    expect(isContinuous([0, 1])).toBe(false);
    expect(isContinuous([8, 9])).toBe(false);
  });
});

describe("枠の状態 (R4-1)", () => {
  const now = at("2026-11-10T00:00:00Z");
  const reservation = (
    status: "pending" | "approved" | "rejected",
    slots: SlotNo[],
  ) => ({ status, slots, date: "2026-11-16" });

  it("何もなければ空き", () => {
    expect(slotStatuses({ now })).toEqual(ALL_FREE);
  });

  it("優先順: 使用止め → 授業 → 予約済み → 仮予約あり → 空き", () => {
    const lessonSlots = { ...ALL_FREE, 1: LESSON, 3: LESSON };
    const result = slotStatuses({
      now,
      lessonSlots,
      blockedPeriods: new Set([1] as const),
      reservations: [
        reservation("approved", [1, 2, 3, 4]),
        reservation("pending", [4, 5, 6]),
      ],
    });
    expect(result[1].kind).toBe("blocked"); // 1限は使用止め(授業より強い)
    expect(result[2].kind).toBe("blocked");
    expect(result[3].kind).toBe("lesson"); // 授業は予約より強い
    expect(result[4].kind).toBe("reserved"); // 承認済みは仮予約より強い
    expect(result[5].kind).toBe("pending");
    expect(result[6].kind).toBe("pending");
    expect(result[7].kind).toBe("free");
  });

  it("却下・取消・取り下げ・期限切れは、枠を塞がない", () => {
    const result = slotStatuses({
      now: at("2026-11-16T05:00:00Z"), // 14:00: 3限が始まったあと
      reservations: [
        reservation("rejected", [1]),
        { status: "cancelled", slots: [2], date: "2026-11-16" },
        { status: "withdrawn", slots: [3], date: "2026-11-16" },
        reservation("pending", [5, 6]), // 13:30に始まった承認待ち = 期限切れ
      ],
    });
    expect(Object.values(result).every((s) => s.kind === "free")).toBe(true);
  });
});

describe("申請の確認 (R4-2〜R4-5)", () => {
  const free = { ...ALL_FREE };
  const base = {
    roomActive: true,
    date: "2026-11-16", // 月曜
    slots: [5, 6] as SlotNo[],
    purpose: "自習",
    note: "",
    slotStatuses: free,
    now: at("2026-11-10T00:00:00Z"),
    closures: NO_CLOSURES,
  };
  const codes = (override: Partial<typeof base>) =>
    checkApplication({ ...base, ...override }).map((issue) => issue.code);

  it("問題がなければ、何も出ない", () => {
    expect(codes({})).toEqual([]);
  });

  it("締め切りは、前の営業日の12:00。月曜の枠は、前の金曜の12:00まで", () => {
    // 金曜 11:59(日本)= 02:59Z
    expect(codes({ now: at("2026-11-13T02:59:00Z") })).toEqual([]);
    // 金曜 12:00(日本)= 03:00Z
    const late = checkApplication({ ...base, now: at("2026-11-13T03:00:00Z") });
    expect(late).toEqual([{ code: "ME101", deadlineDate: "2026-11-13" }]);
  });

  it("祝日(全校の休み)をはさむと、さらに前の営業日になる", () => {
    const closures = [{ startDate: "2026-11-23", endDate: null }];
    // 火曜 11/24 の枠 → 月曜は祝日 → 締め切りは金曜 11/20 12:00
    expect(
      codes({
        date: "2026-11-24",
        closures,
        now: at("2026-11-20T02:59:00Z"),
      }),
    ).toEqual([]);
    expect(
      codes({
        date: "2026-11-24",
        closures,
        now: at("2026-11-20T03:00:00Z"),
      }),
    ).toEqual(["ME101"]);
  });

  it("当日の枠は申請できない(締め切りを必ず過ぎている)", () => {
    expect(codes({ now: at("2026-11-16T00:00:00Z") })).toEqual(["ME101"]);
  });

  it("日本の0時をまたぐ境目: 日曜の夜(日本)は、もう月曜の枠の締め切り後", () => {
    // 日曜 23:30(日本)= 14:30Z。締め切りは金曜12:00なので過ぎている
    expect(codes({ now: at("2026-11-15T14:30:00Z") })).toEqual(["ME101"]);
  });

  it("30日先まで。過ぎた枠は不可", () => {
    expect(
      codes({ date: "2026-12-10", now: at("2026-11-10T00:00:00Z") }),
    ).toEqual([]);
    expect(
      codes({ date: "2026-12-11", now: at("2026-11-10T00:00:00Z") }),
    ).toEqual(["ME102"]);
    expect(
      codes({ date: "2026-11-09", now: at("2026-11-10T00:00:00Z") }),
    ).toEqual(["ME103"]);
  });

  it("続いていない枠・空の選択は ME104", () => {
    expect(codes({ slots: [1, 3] })).toContain("ME104");
    expect(codes({ slots: [] })).toContain("ME104");
  });

  it("授業のある枠は ME105(どの枠か出す)", () => {
    const issues = checkApplication({
      ...base,
      slotStatuses: { ...free, 5: LESSON },
    });
    expect(issues).toEqual([{ code: "ME105", slots: [5] }]);
  });

  it("使用止めは、時限ごと止まる。一部でも入れば、申請ごと受け付けない(ME106)", () => {
    const issues = checkApplication({
      ...base,
      slots: [4, 5],
      slotStatuses: {
        ...free,
        5: { kind: "blocked" },
        6: { kind: "blocked" },
      },
    });
    expect(issues).toEqual([{ code: "ME106", periods: [3] }]);
  });

  it("ほかの申請や承認済みがあっても、申請はできる(MW101、MW102)", () => {
    expect(
      codes({
        slotStatuses: {
          ...free,
          5: { kind: "reserved" },
          6: { kind: "pending" },
        },
      }),
    ).toEqual([]);
  });

  it("用途は3つのどれか(ME107)", () => {
    expect(codes({ purpose: "" })).toEqual(["ME107"]);
    expect(codes({ purpose: "遊び" })).toEqual(["ME107"]);
    for (const purpose of ["自習", "就活", "その他"]) {
      expect(codes({ purpose })).toEqual([]);
    }
  });

  it("備考は100文字まで。全角も半角も1文字(ME108)", () => {
    expect(codes({ note: "あ".repeat(100) })).toEqual([]);
    expect(codes({ note: "a".repeat(100) })).toEqual([]);
    expect(codes({ note: "あ".repeat(101) })).toEqual(["ME108"]);
    // 絵文字も1文字
    expect(characterCount("😀".repeat(100))).toBe(100);
    expect(codes({ note: "😀".repeat(100) })).toEqual([]);
  });

  it("無効な教室は ME109", () => {
    expect(codes({ roomActive: false })).toEqual(["ME109"]);
  });

  it("全部のエラーを、表の順に返す", () => {
    expect(
      codes({
        roomActive: false,
        date: "2026-11-09",
        slots: [1, 3],
        purpose: "",
        note: "あ".repeat(101),
      }),
    ).toEqual(["ME109", "ME103", "ME104", "ME107", "ME108"]);
  });
});

describe("申請の文言 (10章)", () => {
  const context = { date: "2026-11-16", today: "2026-11-10" };
  it("Notion の文言どおり", () => {
    expect(
      applicationMessage(
        { code: "ME101", deadlineDate: "2026-11-13" },
        context,
      ),
    ).toBe(
      "申請の締め切りを過ぎています(11/16(月)の枠は、11/13(金) 12:00まで)。",
    );
    expect(applicationMessage({ code: "ME102" }, context)).toBe(
      "申請できるのは、30日先(12/10(木))までです。",
    );
    expect(applicationMessage({ code: "ME105", slots: [5, 6] }, context)).toBe(
      "授業がある枠は申請できません(3限前半、3限後半)。",
    );
    expect(applicationMessage({ code: "ME106", periods: [3] }, context)).toBe(
      "使用止めの時限が含まれています(11/16 3限)。",
    );
    expect(applicationMessage({ code: "ME108" }, context)).toBe(
      "備考は100文字までです。",
    );
  });
});

describe("承認の確認 (R4-7、R4-8)", () => {
  const base = {
    stored: "pending" as StoredReservationStatus,
    date: "2026-11-16",
    slots: [5, 6] as SlotNo[],
    now: at("2026-11-12T00:00:00Z"),
    fixedSlotStatuses: { ...ALL_FREE },
    undecidedClasses: [] as string[],
    otherPending: 0,
    otherApproved: false,
    homeroomClassesWithUndecidedLesson: [] as string[],
  };
  const check = (override: Partial<typeof base>) =>
    checkApproval({ ...base, ...override });

  it("条件を満たせば、そのまま承認できる", () => {
    expect(check({})).toEqual({
      kind: "checked",
      blockers: [],
      warnings: [],
      needsConfirmation: false,
    });
  });

  it("承認待ちでなければ、ほかの人が先に対応した(ME902)", () => {
    for (const stored of [
      "approved",
      "rejected",
      "cancelled",
      "withdrawn",
    ] as const) {
      expect(check({ stored })).toEqual({ kind: "conflict" });
    }
  });

  it("最初の枠が始まったら ME204(その時刻ちょうどから)", () => {
    const justBefore = check({ now: at("2026-11-16T04:29:59Z") });
    expect(justBefore).toMatchObject({ blockers: [] });
    const started = check({ now: at("2026-11-16T04:30:00Z") });
    expect(started).toMatchObject({ blockers: [{ code: "ME204" }] });
  });

  it("未入力のクラスがあれば ME201(クラス名つき)", () => {
    expect(check({ undecidedClasses: ["A組", "B組"] })).toMatchObject({
      blockers: [{ code: "ME201", classes: ["A組", "B組"] }],
    });
  });

  it("申請のあとに授業が入れば ME202、使用止めが入れば ME203", () => {
    expect(
      check({ fixedSlotStatuses: { ...ALL_FREE, 6: LESSON } }),
    ).toMatchObject({ blockers: [{ code: "ME202" }] });
    expect(
      check({ fixedSlotStatuses: { ...ALL_FREE, 5: { kind: "blocked" } } }),
    ).toMatchObject({ blockers: [{ code: "ME203" }] });
    expect(
      check({
        undecidedClasses: ["A組"],
        fixedSlotStatuses: {
          ...ALL_FREE,
          5: LESSON,
          6: { kind: "blocked" },
        },
      }),
    ).toMatchObject({
      blockers: [{ code: "ME201" }, { code: "ME202" }, { code: "ME203" }],
    });
  });

  it("警告は承認を止めない。承認済みが同じ枠にあれば、確認(MC201)が要る", () => {
    const result = check({
      otherPending: 2,
      otherApproved: true,
      homeroomClassesWithUndecidedLesson: ["A組"],
    });
    expect(result).toMatchObject({
      blockers: [],
      needsConfirmation: true,
      warnings: [
        { code: "MW201", count: 2 },
        { code: "MW202" },
        { code: "MW203", classes: ["A組"] },
      ],
    });
  });

  it("警告と止める理由の文言", () => {
    expect(warningMessage({ code: "MW201", count: 2 })).toBe(
      "同じ枠に、ほかの承認待ちの申請があります(2件)。",
    );
    expect(blockerMessage({ code: "ME201", classes: ["A組", "B組"] })).toBe(
      "時間割が未定のクラスがあるため、承認できません(未入力: A組、B組)。",
    );
    expect(
      approvalWarnings({
        otherPending: 0,
        otherApproved: false,
        homeroomClassesWithUndecidedLesson: [],
      }),
    ).toEqual([]);
  });
});

describe("却下・取消・取り下げ (R4-6)", () => {
  const input = {
    date: "2026-11-16",
    slots: [5] as SlotNo[],
    now: at("2026-11-12T00:00:00Z"),
  };
  const started = at("2026-11-16T04:30:00Z");

  it("却下: 承認待ちで、開始前", () => {
    expect(canReject({ ...input, stored: "pending" })).toBe("ok");
    expect(canReject({ ...input, stored: "pending", now: started })).toBe(
      "ME204",
    );
    expect(canReject({ ...input, stored: "approved" })).toBe("conflict");
  });

  it("取消: 承認済みで、最初の枠の開始前。始まったら取り消せない", () => {
    expect(canCancel({ ...input, stored: "approved" })).toBe("ok");
    expect(
      canCancel({
        ...input,
        stored: "approved",
        now: at("2026-11-16T04:29:59Z"),
      }),
    ).toBe("ok");
    expect(canCancel({ ...input, stored: "approved", now: started })).toBe(
      "ME205",
    );
    expect(canCancel({ ...input, stored: "pending" })).toBe("conflict");
    expect(canCancel({ ...input, stored: "cancelled" })).toBe("conflict");
  });

  it("取り下げ: 承認待ちで、開始前。対応済み・期限切れは ME110", () => {
    expect(canWithdraw({ ...input, stored: "pending" })).toBe("ok");
    expect(canWithdraw({ ...input, stored: "pending", now: started })).toBe(
      "ME110",
    );
    for (const stored of [
      "approved",
      "rejected",
      "cancelled",
      "withdrawn",
    ] as const) {
      expect(canWithdraw({ ...input, stored })).toBe("ME110");
    }
  });
});

describe("使用止め (R4-10)", () => {
  const block: BlockRange = {
    startDate: "2026-11-20",
    startPeriod: 3,
    endDate: "2026-11-22",
    endPeriod: 2,
  };

  it("範囲は、開始の時限から終了の時限まで(両端を含む)", () => {
    expect(blockCovers(block, "2026-11-20", 2)).toBe(false);
    expect(blockCovers(block, "2026-11-20", 3)).toBe(true);
    expect(blockCovers(block, "2026-11-21", 1)).toBe(true);
    expect(blockCovers(block, "2026-11-21", 4)).toBe(true);
    expect(blockCovers(block, "2026-11-22", 2)).toBe(true);
    expect(blockCovers(block, "2026-11-22", 3)).toBe(false);
    expect(blockCovers(block, "2026-11-19", 4)).toBe(false);
    expect(blockCovers(block, "2026-11-23", 1)).toBe(false);
  });

  it("日ごとの止まる時限", () => {
    expect([...blockedPeriodsOn([block], "2026-11-20")]).toEqual([3, 4]);
    expect([...blockedPeriodsOn([block], "2026-11-21")]).toEqual([1, 2, 3, 4]);
    expect([...blockedPeriodsOn([block], "2026-11-22")]).toEqual([1, 2]);
    expect(blockedPeriodsOn([block], "2026-11-19").size).toBe(0);
  });

  it("年またぎ・月またぎでも、日付の文字の順で正しく比べられる", () => {
    const across: BlockRange = {
      startDate: "2026-12-30",
      startPeriod: 4,
      endDate: "2027-01-05",
      endPeriod: 1,
    };
    expect(blockCovers(across, "2026-12-31", 1)).toBe(true);
    expect(blockCovers(across, "2027-01-05", 1)).toBe(true);
    expect(blockCovers(across, "2027-01-05", 2)).toBe(false);
  });

  it("終わりは、終了の時限が終わる時刻", () => {
    expect(blockEndAt(block).toISOString()).toBe("2026-11-22T03:30:00.000Z"); // 2限 12:30
  });

  it("ME301: 終了が開始より前。ME302: 始まった時限", () => {
    const now = at("2026-11-10T00:00:00Z");
    expect(checkBlockInput({ ...block, now })).toEqual([]);
    expect(
      checkBlockInput({ ...block, endDate: "2026-11-19", now }).map(
        (i) => i.code,
      ),
    ).toEqual(["ME301"]);
    expect(
      checkBlockInput({
        ...block,
        startDate: "2026-11-20",
        startPeriod: 2,
        endDate: "2026-11-20",
        endPeriod: 1,
        now,
      }).map((i) => i.code),
    ).toEqual(["ME301"]);
    // 同じ日・同じ時限は1時限だけの使用止め = よい
    expect(
      checkBlockInput({
        ...block,
        endDate: block.startDate,
        endPeriod: 3,
        now,
      }),
    ).toEqual([]);
    // 3限が始まる 13:30(日本)= 04:30Z ちょうどから、3限は指定できない
    const today = {
      startDate: "2026-11-20",
      startPeriod: 3 as const,
      endDate: "2026-11-20",
      endPeriod: 4 as const,
    };
    expect(
      checkBlockInput({ ...today, now: at("2026-11-20T04:29:59Z") }),
    ).toEqual([]);
    expect(
      checkBlockInput({ ...today, now: at("2026-11-20T04:30:00Z") }).map(
        (i) => i.code,
      ),
    ).toEqual(["ME302"]);
  });

  it("重なる承認済みの予約と授業の数え方(MW301、MW302)", () => {
    expect(
      reservationInBlock(block, { date: "2026-11-20", slots: [5, 6] }),
    ).toBe(true);
    expect(
      reservationInBlock(block, { date: "2026-11-20", slots: [3, 4] }),
    ).toBe(false);
    // 3限(13:30〜15:00)にかかる授業は重なる。終わりと始まりが同じ時刻なら重ならない
    const lesson = (startMinutes: number, endMinutes: number) => ({
      date: "2026-11-20",
      startMinutes,
      endMinutes,
      cancelled: false,
    });
    expect(lessonInBlock(block, lesson(13 * 60 + 30, 15 * 60))).toBe(true);
    expect(lessonInBlock(block, lesson(11 * 60, 12 * 60 + 30))).toBe(false);
    expect(lessonInBlock(block, lesson(12 * 60, 13 * 60 + 30))).toBe(false);
    expect(
      lessonInBlock(block, {
        ...lesson(13 * 60 + 30, 15 * 60),
        cancelled: true,
      }),
    ).toBe(false);
  });
});

describe("一覧の並び", () => {
  const row = (date: string, slots: SlotNo[]) => ({ date, slots });

  it("日付と最初の枠の早い順", () => {
    const rows = [
      row("2026-11-17", [1]),
      row("2026-11-16", [5]),
      row("2026-11-16", [2]),
    ];
    expect(
      rows.sort(compareByStart).map((r) => `${r.date}/${r.slots[0]}`),
    ).toEqual(["2026-11-16/2", "2026-11-16/5", "2026-11-17/1"]);
  });

  it("S07: これからの予約は近い順、終わったものはその下に新しい順", () => {
    const now = at("2026-11-16T05:00:00Z"); // 14:00(日本)
    const ordered = orderMine(
      [
        row("2026-11-10", [1]),
        row("2026-11-20", [1]),
        row("2026-11-16", [5, 6]), // 13:30-15:00 は進行中 = まだ終わっていない
        row("2026-11-12", [1]),
        row("2026-11-17", [1]),
      ],
      now,
    );
    expect(ordered.map((r) => r.date)).toEqual([
      "2026-11-16",
      "2026-11-17",
      "2026-11-20",
      "2026-11-12",
      "2026-11-10",
    ]);
  });
});

describe("申請の入力の形", () => {
  const valid = {
    roomId: "5b0f2f3a-8a4e-4a39-8a5c-1e6a0a1d3b11",
    date: "2026-11-16",
    slots: ["6", "5", "5"],
    purpose: " 自習 ",
    note: " メモ ",
  };
  it("フォームの文字を、数にして並べ、重ねず、前後の空白を取る", () => {
    const parsed = reservationInputSchema.parse(valid);
    expect(normalizeInput(parsed)).toEqual({
      roomId: valid.roomId,
      date: "2026-11-16",
      slots: [5, 6],
      purpose: "自習",
      note: "メモ",
    });
  });
  it("存在しない日付や、範囲の外の枠は通さない", () => {
    expect(
      reservationInputSchema.safeParse({ ...valid, date: "2026-02-30" })
        .success,
    ).toBe(false);
    expect(
      reservationInputSchema.safeParse({ ...valid, slots: ["9"] }).success,
    ).toBe(false);
    expect(
      reservationInputSchema.safeParse({ ...valid, slots: ["0"] }).success,
    ).toBe(false);
    expect(
      reservationInputSchema.safeParse({ ...valid, slots: ["x"] }).success,
    ).toBe(false);
    expect(
      reservationInputSchema.safeParse({
        ...valid,
        slots: Array.from({ length: 9 }, () => "1"),
      }).success,
    ).toBe(false);
  });
});
