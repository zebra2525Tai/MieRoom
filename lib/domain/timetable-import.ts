import { MESSAGES } from "../messages";
import type { ClosureItem } from "./closures";
import { monthWindow } from "./import-window";
import {
  parseTimetableFile,
  type ImportIssue,
  type ImportMasters,
  type ParsedClosure,
  type ParsedLesson,
  type ParsedTimetable,
} from "./timetable-csv";
import { addDays, addMonths, fiscalYearOfDate } from "./school-date";

// Checks the files chosen together (外部設計書 R3-2, R3-3, R3-5, ME404〜ME408, ME418) and
// works out what to write for one class and month (R3-6, R3-10). No I/O here.

import { MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES } from "./import-limits";

export { MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES };

export type ImportContext = {
  /** A school date. */
  today: string;
  masters: ImportMasters;
  /** 例外解除 (R3-5): "クラス名|YYYY-MM" of the class and month that may be imported after the closing day. */
  unlocked: ReadonlySet<string>;
};

export type FileCheck = {
  name: string;
  className: string | null;
  /** "YYYY-MM" */
  month: string | null;
  lessonCount: number;
  closureCount: number;
  verdict: "ok" | "warning" | "error";
  issues: ImportIssue[];
};

export type ImportItem = ParsedTimetable;

export type ImportCheck = {
  files: FileCheck[];
  /** About the whole selection (too many files, ...). */
  general: ImportIssue[];
  /** True when nothing is an error: only then can it be imported. */
  ok: boolean;
  /** The files to import, in the order chosen. Empty unless `ok`. */
  items: ImportItem[];
};

/** What the screen shows after 「確認する」. Never holds the file contents. */
export type ImportCheckView = {
  files: FileCheck[];
  general: ImportIssue[];
  ok: boolean;
  /** Lessons changed in the system that the import would replace (R3-12). */
  lostChanges: number;
};

export type ImportSummary = {
  /** MI402: one line for each month. */
  months: { month: string; classes: number; lessons: number }[];
};

export type ApplyResult =
  | { kind: "invalid"; view: ImportCheckView }
  | { kind: "imported"; view: ImportCheckView; summary: ImportSummary };

/** The messages shown for one file; the rest is counted (the tool shows 15 and counts the rest). */
export const MAX_SHOWN_ISSUES = 30;

const LEVEL_ORDER = { error: 0, warning: 1, info: 2 } as const;

function shownIssues(issues: ImportIssue[]): ImportIssue[] {
  const sorted = [...issues].sort(
    (a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level],
  );
  if (sorted.length <= MAX_SHOWN_ISSUES) return sorted;
  return [
    ...sorted.slice(0, MAX_SHOWN_ISSUES),
    {
      level: "info",
      code: "",
      line: null,
      message: `…ほか${sorted.length - MAX_SHOWN_ISSUES}件`,
    },
  ];
}

export const unlockKey = (className: string, month: string) =>
  `${className}|${month}`;

export function checkTimetableImport(
  files: { name: string; bytes: Uint8Array }[],
  context: ImportContext,
): ImportCheck {
  const general: ImportIssue[] = [];
  const totalBytes = files.reduce((sum, file) => sum + file.bytes.length, 0);
  if (files.length > MAX_FILES || totalBytes > MAX_TOTAL_BYTES) {
    general.push({
      level: "error",
      code: "ME418",
      line: null,
      message: MESSAGES.ME418,
    });
  }

  const results: (FileCheck & { parsed: ParsedTimetable | null })[] = files.map(
    (file) => {
      if (file.bytes.length > MAX_FILE_BYTES) {
        return {
          name: file.name,
          className: null,
          month: null,
          lessonCount: 0,
          closureCount: 0,
          verdict: "error",
          issues: [
            {
              level: "error",
              code: "ME418",
              line: null,
              message: MESSAGES.ME418,
            },
          ],
          parsed: null,
        };
      }
      const read = parseTimetableFile(file.bytes, context.masters);
      const issues = [...read.issues];
      const error = (code: string, message: string) =>
        issues.push({ level: "error", code, line: null, message });

      // The month and the class decide the rest (R3-3, R3-5, ME408).
      if (read.month !== null && read.className !== null) {
        const [year, monthNo] = read.month.split("-").map(Number);
        switch (monthWindow(context.today, read.month)) {
          case "past":
            error("ME405", MESSAGES.ME405(year, monthNo));
            break;
          case "not-yet":
            error("ME406", MESSAGES.ME406);
            break;
          case "closed":
            if (!context.unlocked.has(unlockKey(read.className, read.month))) {
              error("ME407", MESSAGES.ME407(monthNo));
            }
            break;
          case "open":
            break;
        }
        const item = context.masters.classes.find(
          (c) => c.name === read.className,
        );
        const fiscalYear = fiscalYearOfDate(`${read.month}-01`);
        if (
          item !== undefined &&
          !(
            item.startYear <= fiscalYear &&
            (item.endYear === null || fiscalYear <= item.endYear)
          )
        ) {
          error("ME408", MESSAGES.ME408(read.className, fiscalYear));
        }
      }
      return {
        name: file.name,
        className: read.className,
        month: read.month,
        lessonCount: read.parsed?.lessons.length ?? 0,
        closureCount: read.parsed?.closures.length ?? 0,
        verdict: "ok",
        issues,
        parsed: read.parsed,
      };
    },
  );

  // ME404: the same class and month twice.
  const byKey = new Map<string, number[]>();
  results.forEach((result, i) => {
    if (result.className === null || result.month === null) return;
    const key = unlockKey(result.className, result.month);
    byKey.set(key, [...(byKey.get(key) ?? []), i]);
  });
  for (const indexes of byKey.values()) {
    if (indexes.length < 2) continue;
    const names = indexes.map((i) => results[i].name);
    for (const i of indexes) {
      results[i].issues.push({
        level: "error",
        code: "ME404",
        line: null,
        message: MESSAGES.ME404(names[0], names[1]),
      });
    }
  }

  const checks: FileCheck[] = results.map((result) => ({
    name: result.name,
    className: result.className,
    month: result.month,
    lessonCount: result.lessonCount,
    closureCount: result.closureCount,
    issues: shownIssues(result.issues),
    verdict: result.issues.some((i) => i.level === "error")
      ? "error"
      : result.issues.some((i) => i.level === "warning")
        ? "warning"
        : "ok",
  }));
  const ok =
    general.every((i) => i.level !== "error") &&
    checks.length > 0 &&
    checks.every((c) => c.verdict !== "error");
  return {
    files: checks,
    general,
    ok,
    items: ok
      ? results.flatMap((r) => (r.parsed === null ? [] : [r.parsed]))
      : [],
  };
}

// ---- what to write for one class and month (R3-2, R3-6, R3-10) -------------------------

export type WritePlan = {
  className: string;
  /** Lessons and 休み・行事 dated in these ranges (inclusive) of the class are removed first. */
  replace: { from: string; to: string }[];
  lessons: ParsedLesson[];
  /** Not saved when the same date and name are already a closure of the whole school (R3-10). */
  closures: ParsedClosure[];
  status: {
    month: string;
    lastInputDate: string;
    nextLastInputDate: string | null;
  };
};

/**
 * The dates a file of month M replaces: the month, and 1st to 11th of the next month while
 * the class has no file of the next month yet (R3-6). Never April for March (R3-4).
 */
export function replaceRanges(
  month: string,
  nextMonthImported: boolean,
): { from: string; to: string }[] {
  const next = addMonths(month, 1);
  const monthEnd = addDays(`${next}-01`, -1);
  const saveNext = !nextMonthImported && !month.endsWith("-03");
  return [
    { from: `${month}-01`, to: monthEnd },
    ...(saveNext ? [{ from: `${next}-01`, to: `${next}-11` }] : []),
  ];
}

/**
 * The file of month M replaces the class's month M, whatever its source (R3-2: rows of the
 * earlier file's provisional days and changes made in the system are replaced too, R3-12).
 * The provisional days of M+1 are saved only while the class has no file of M+1 (R3-6).
 */
export function planWrite(
  item: ImportItem,
  state: {
    /** The class already has an imported file of the next month. */
    nextMonthImported: boolean;
    /** Closures of the whole school (E13 from the system). */
    schoolClosures: readonly ClosureItem[];
  },
): WritePlan {
  const ranges = replaceRanges(item.month, state.nextMonthImported);
  const keep = (date: string) =>
    ranges.some((range) => date >= range.from && date <= range.to);

  const sameAsSchool = (closure: ParsedClosure) =>
    state.schoolClosures.some(
      (school) =>
        school.name === closure.name &&
        closure.date >= school.startDate &&
        closure.date <= (school.endDate ?? school.startDate),
    );

  return {
    className: item.className,
    replace: ranges,
    lessons: item.lessons.filter((lesson) => keep(lesson.date)),
    closures: item.closures.filter(
      (closure) => keep(closure.date) && !sameAsSchool(closure),
    ),
    status: {
      month: item.month,
      lastInputDate: item.lastInputDate,
      nextLastInputDate: item.nextLastInputDate,
    },
  };
}
