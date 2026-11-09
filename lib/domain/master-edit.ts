import { z } from "zod";
import { MESSAGES } from "@/lib/messages";
import { clean } from "./access";

// マスタの入力の規則 (外部設計書 R5-1〜R5-5, S21). No I/O here: the rules, and the words for them.
// 前後の空白(半角・全角)は取る。文字数は、全角・半角を問わず1文字と数える (6-3)。

export type MasterKind = "classes" | "teachers" | "subjects" | "rooms";

export type FieldError = { field: string; message: string };

export type Parsed<T> =
  { ok: true; value: T } | { ok: false; errors: FieldError[] };

/** Without the spaces around it. A text only; anything else is empty. */
const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const length = (value: string) => [...value].length;

/** Full-width digits to half-width, nothing else (教室名: ツールと同じ。R5-1). */
const halfWidthDigits = (value: string) =>
  value.replace(/[０-９]/g, (digit) =>
    String.fromCharCode(digit.charCodeAt(0) - 0xfee0),
  );

const FORBIDDEN_TEACHER_NAMES = ["各担当", "外部講師"];

type Check = (errors: FieldError[]) => void;

/** A required text of at most `max` characters. Errors go to `errors`. */
function required(
  errors: FieldError[],
  field: string,
  value: string,
  max: number,
): void {
  if (value === "") errors.push({ field, message: MESSAGES.ME501 });
  else if (length(value) > max) {
    errors.push({ field, message: MESSAGES.ME504(max) });
  }
}

function optional(
  errors: FieldError[],
  field: string,
  value: string,
  max: number,
): void {
  if (length(value) > max) {
    errors.push({ field, message: MESSAGES.ME504(max) });
  }
}

const finish = <T>(errors: FieldError[], build: () => T): Parsed<T> =>
  errors.length > 0 ? { ok: false, errors } : { ok: true, value: build() };

const record = (raw: unknown): Record<string, unknown> =>
  typeof raw === "object" && raw !== null && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};

// ---------------------------------------------------------------- 教室

export type RoomInput = {
  name: string;
  building: string | null;
  kind: "HOMEROOM" | "FREE";
  note: string | null;
};

export function parseRoom(raw: unknown): Parsed<RoomInput> {
  const input = record(raw);
  const errors: FieldError[] = [];
  const name = halfWidthDigits(text(input.name));
  const building = text(input.building);
  const note = text(input.note);
  required(errors, "name", name, 20);
  // 「ー」 is the mark of a lesson without a room in the CSV (R3-9).
  if (/^[ー－―ｰ-]$/.test(name)) {
    errors.push({ field: "name", message: MESSAGES.ME518 });
  }
  optional(errors, "building", building, 20);
  optional(errors, "note", note, 50);
  if (input.kind !== "HOMEROOM" && input.kind !== "FREE") {
    errors.push({ field: "kind", message: MESSAGES.ME501 });
  }
  return finish(errors, () => ({
    name,
    building: building === "" ? null : building,
    kind: input.kind as RoomInput["kind"],
    note: note === "" ? null : note,
  }));
}

// ---------------------------------------------------------------- 講師

export type TeacherInput = { displayName: string; email: string | null };

const emailSchema = z.string().email().max(254);

export function parseTeacher(raw: unknown): Parsed<TeacherInput> {
  const input = record(raw);
  const errors: FieldError[] = [];
  const displayName = text(input.displayName);
  const email = text(input.email).toLowerCase();
  required(errors, "displayName", displayName, 20);
  if (FORBIDDEN_TEACHER_NAMES.includes(displayName)) {
    errors.push({ field: "displayName", message: MESSAGES.ME503 });
  }
  // 「、」 separates several teachers in the CSV.
  if (displayName.includes("、")) {
    errors.push({ field: "displayName", message: MESSAGES.ME515 });
  }
  if (email !== "" && !emailSchema.safeParse(email).success) {
    errors.push({ field: "email", message: MESSAGES.ME516 });
  }
  return finish(errors, () => ({
    displayName,
    email: email === "" ? null : email,
  }));
}

// ---------------------------------------------------------------- 教科

export type SubjectInput = { name: string };

export function parseSubject(raw: unknown): Parsed<SubjectInput> {
  const errors: FieldError[] = [];
  const name = text(record(raw).name);
  required(errors, "name", name, 30);
  return finish(errors, () => ({ name }));
}

// ---------------------------------------------------------------- クラス

export type ClassInput = {
  name: string;
  homeRoomId: string;
  startYear: number;
  endYear: number | null;
};

const YEAR = /^\d{4}$/;

export function parseClass(raw: unknown): Parsed<ClassInput> {
  const input = record(raw);
  const errors: FieldError[] = [];
  const name = text(input.name);
  const homeRoomId = text(input.homeRoomId);
  const start = clean(String(input.startYear ?? ""));
  const end = clean(String(input.endYear ?? ""));
  required(errors, "name", name, 30);
  if (homeRoomId === "")
    errors.push({ field: "homeRoomId", message: MESSAGES.ME501 });
  if (start === "")
    errors.push({ field: "startYear", message: MESSAGES.ME501 });
  else if (!YEAR.test(start)) {
    errors.push({ field: "startYear", message: MESSAGES.ME517 });
  }
  if (end !== "" && !YEAR.test(end)) {
    errors.push({ field: "endYear", message: MESSAGES.ME517 });
  } else if (end !== "" && YEAR.test(start) && Number(end) < Number(start)) {
    errors.push({ field: "endYear", message: MESSAGES.ME505 });
  }
  return finish(errors, () => ({
    name,
    homeRoomId,
    startYear: Number(start),
    endYear: end === "" ? null : Number(end),
  }));
}

export const PARSERS = {
  classes: parseClass,
  teachers: parseTeacher,
  subjects: parseSubject,
  rooms: parseRoom,
} as const;

export const isMasterKind = (value: unknown): value is MasterKind =>
  value === "classes" ||
  value === "teachers" ||
  value === "subjects" ||
  value === "rooms";

export type { Check };
