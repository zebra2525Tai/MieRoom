import { MESSAGES } from "@/lib/messages";
import type { FieldError, Parsed } from "./master-edit";
import { isSchoolDate } from "./school-date";

// 休み・行事の入力の規則 (外部設計書 S23, R3-10). No I/O here.
// 前後の空白(半角・全角)は取る。文字数は、全角・半角を問わず1文字と数える (6-3)。

export type ClosureInput = {
  startDate: string;
  /** null: one day only */
  endDate: string | null;
  name: string;
  /** null: the whole school */
  classId: string | null;
};

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

/** A date the calendar has, in a sensible range. */
const validDate = (value: string) =>
  isSchoolDate(value) && value >= "2000-01-01" && value <= "2100-12-31";

export function parseClosure(raw: unknown): Parsed<ClosureInput> {
  const input =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const errors: FieldError[] = [];
  const startDate = text(input.startDate);
  const endDate = text(input.endDate);
  const name = text(input.name);
  const classId = text(input.classId);

  if (startDate === "") {
    errors.push({ field: "startDate", message: MESSAGES.ME501 });
  } else if (!validDate(startDate)) {
    errors.push({ field: "startDate", message: MESSAGES.ME520 });
  }
  if (endDate !== "") {
    if (!validDate(endDate)) {
      errors.push({ field: "endDate", message: MESSAGES.ME520 });
    } else if (validDate(startDate) && endDate < startDate) {
      errors.push({ field: "endDate", message: MESSAGES.ME519 });
    }
  }
  if (name === "") {
    errors.push({ field: "name", message: MESSAGES.ME501 });
  } else if ([...name].length > 20) {
    errors.push({ field: "name", message: MESSAGES.ME504(20) });
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      startDate,
      // The same day is the same as no end date.
      endDate: endDate === "" || endDate === startDate ? null : endDate,
      name,
      classId: classId === "" ? null : classId,
    },
  };
}
