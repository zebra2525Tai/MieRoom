"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, fieldClass, textareaClass } from "@/components/ui/form";
import { Callout, Card } from "@/components/ui/parts";
import { PURPOSES, NOTE_MAX_LENGTH } from "@/lib/domain/reservation-core";
import { SLOTS, type PeriodNo, type SlotNo } from "@/lib/domain/periods";
import type { SlotStatus } from "@/lib/domain/room-status";
import { MESSAGES, SYSTEM_ERROR_MESSAGE } from "@/lib/messages";
import { SlotBadge } from "./rooms-view";

type FieldName = "room" | "date" | "slots" | "purpose" | "note";
type Issue = { code: string; field: FieldName; message: string };

const selectable = (status: SlotStatus) =>
  status.kind !== "lesson" && status.kind !== "blocked";

async function post(
  endpoint: string,
  body: unknown,
): Promise<{ ok: true; notice: string } | { ok: false; issues: Issue[] }> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data: unknown = await response.json().catch(() => null);
    const record =
      typeof data === "object" && data !== null
        ? (data as Record<string, unknown>)
        : {};
    if (response.ok && typeof record.notice === "string") {
      return { ok: true, notice: record.notice };
    }
    if (Array.isArray(record.issues)) {
      return { ok: false, issues: record.issues as Issue[] };
    }
    const message =
      typeof record.message === "string"
        ? record.message
        : SYSTEM_ERROR_MESSAGE;
    return { ok: false, issues: [{ code: "", field: "slots", message }] };
  } catch {
    return {
      ok: false,
      issues: [{ code: "ME901", field: "slots", message: MESSAGES.ME901 }],
    };
  }
}

// The slots, purpose and note of S06 (申請) and S12 (代理入力). The server checks everything
// again; what is shown here is only to help. 選んだ枠に申請や予約があるときは警告を出す
// (MW101、MW102)。申請はできる。
export function ReservationForm({
  endpoint,
  successPath,
  roomId,
  date,
  periodNo,
  statuses,
  submitLabel,
  applicantLabel,
  disabled = false,
}: {
  endpoint: string;
  successPath: string;
  roomId: string | null;
  date: string;
  periodNo: PeriodNo | null;
  statuses: Record<SlotNo, SlotStatus> | null;
  submitLabel: string;
  applicantLabel: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<Set<number>>(() =>
    statuses
      ? new Set(
          SLOTS.filter(
            (slot) =>
              slot.periodNo === periodNo && selectable(statuses[slot.no]),
          ).map((slot) => slot.no),
        )
      : new Set(),
  );
  const [purpose, setPurpose] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);

  const errorOf = (field: FieldName) =>
    issues.find((issue) => issue.field === field)?.message;
  const kinds = new Set([...chosen].map((n) => statuses?.[n as SlotNo]?.kind));

  return (
    <Card className="p-5 sm:p-6">
      <form
        className="flex flex-col gap-5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || roomId === null) return;
          setBusy(true);
          setIssues([]);
          const result = await post(endpoint, {
            roomId,
            date,
            slots: [...chosen].sort((a, b) => a - b),
            purpose,
            note,
          });
          if (result.ok) {
            router.push(`${successPath}?notice=${result.notice}`);
            return;
          }
          setIssues(result.issues);
          setBusy(false);
        }}
      >
        <fieldset>
          <legend className="mb-2 text-xs font-semibold">
            枠<span className="ml-1.5 text-[11px] text-[#a3101f]">必須</span>
            <span className="ml-2 font-normal text-muted">
              続けて選んでください
            </span>
          </legend>
          {statuses ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {SLOTS.map((slot) => {
                const status = statuses[slot.no];
                const enabled = selectable(status);
                return (
                  <label
                    key={slot.no}
                    className={`flex items-center gap-2.5 rounded-lg border border-line p-3 text-xs ${
                      enabled ? "cursor-pointer" : "bg-[#f6f8fc] opacity-70"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="slots"
                      value={slot.no}
                      disabled={!enabled}
                      checked={chosen.has(slot.no)}
                      onChange={(event) => {
                        const next = new Set(chosen);
                        if (event.target.checked) next.add(slot.no);
                        else next.delete(slot.no);
                        setChosen(next);
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold">{slot.label}</span>
                      <span className="block text-[11px] text-muted">
                        {slot.start}-{slot.end}
                      </span>
                    </span>
                    <span className="ml-auto">
                      <SlotBadge status={status} />
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <Callout kind="neutral" className="">
              先に教室を選ぶと、枠の状態が出ます。
            </Callout>
          )}
          {errorOf("slots") && (
            <p role="alert" className="mt-2 text-[11px] text-red-ink">
              {errorOf("slots")}
            </p>
          )}
          {errorOf("room") && (
            <p role="alert" className="mt-2 text-[11px] text-red-ink">
              {errorOf("room")}
            </p>
          )}
          {errorOf("date") && (
            <p role="alert" className="mt-2 text-[11px] text-red-ink">
              {errorOf("date")}
            </p>
          )}
          {kinds.has("pending") && (
            <Callout kind="warning" className="mt-3">
              {MESSAGES.MW101}
            </Callout>
          )}
          {kinds.has("reserved") && (
            <Callout kind="warning" className="mt-3">
              {MESSAGES.MW102}
            </Callout>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="用途" required error={errorOf("purpose")}>
            <select
              name="purpose"
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              className={fieldClass}
            >
              <option value="" disabled>
                選んでください
              </option>
              {PURPOSES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
          <Field label="申請者">
            <input
              readOnly
              value={applicantLabel}
              className={`${fieldClass} bg-[#edf0f5] text-[#586579]`}
            />
          </Field>
          <Field
            label="備考"
            full
            help={`${NOTE_MAX_LENGTH}文字まで`}
            error={errorOf("note")}
          >
            <textarea
              name="note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className={textareaClass}
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            disabled={disabled || busy || roomId === null || chosen.size === 0}
          >
            {submitLabel}
          </Button>
        </div>
      </form>
    </Card>
  );
}
