"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FormActions,
  fieldClass,
  selectClass,
} from "@/components/ui/form";
import { PERIODS } from "@/lib/domain/periods";
import { MESSAGES, SYSTEM_ERROR_MESSAGE } from "@/lib/messages";

// S13 「追加」. The server checks the room, the order and the start again (ME301, ME302).
export function BlockForm({
  rooms,
  today,
}: {
  rooms: { id: string; name: string }[];
  today: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const form = new FormData(event.currentTarget);
        setBusy(true);
        setError(null);
        try {
          const response = await fetch("/teacher/blocks/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomId: form.get("room"),
              startDate: form.get("startDate"),
              startPeriod: form.get("startPeriod"),
              endDate: form.get("endDate"),
              endPeriod: form.get("endPeriod"),
            }),
          });
          const data: unknown = await response.json().catch(() => null);
          const record =
            typeof data === "object" && data !== null
              ? (data as Record<string, unknown>)
              : {};
          if (response.ok) {
            const reservations = Number(record.reservations) || 0;
            const lessons = Number(record.lessons) || 0;
            router.push(
              `/teacher/blocks?notice=MI301&r=${reservations}&l=${lessons}`,
            );
            router.refresh();
            return;
          }
          setError(
            typeof record.message === "string"
              ? record.message
              : SYSTEM_ERROR_MESSAGE,
          );
        } catch {
          setError(MESSAGES.ME901);
        }
        setBusy(false);
      }}
    >
      <Field label="教室" required full>
        <select
          name="room"
          defaultValue=""
          required
          className={`${selectClass} sm:w-[calc(50%-0.5rem)] md:max-lg:w-full`}
        >
          <option value="" disabled>
            選んでください
          </option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2 md:max-lg:col-span-2">
        <Field label="開始日" required>
          <input
            type="date"
            name="startDate"
            min={today}
            defaultValue={today}
            required
            className={fieldClass}
          />
        </Field>
        <Field label="開始の時限" required>
          <select name="startPeriod" className={selectClass}>
            {PERIODS.map((period) => (
              <option key={period.no} value={period.no}>
                {period.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2 md:max-lg:col-span-2">
        <Field label="終了日" required>
          <input
            type="date"
            name="endDate"
            min={today}
            defaultValue={today}
            required
            className={fieldClass}
          />
        </Field>
        <Field label="終了の時限" required>
          <select name="endPeriod" defaultValue={4} className={selectClass}>
            {PERIODS.map((period) => (
              <option key={period.no} value={period.no}>
                {period.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <FormActions className="sm:col-span-2">
        <Button type="submit" variant="primary" disabled={busy}>
          設定する
        </Button>
      </FormActions>
      {error && (
        <p role="alert" className="text-[11px] text-red-ink sm:col-span-2">
          {error}
        </p>
      )}
    </form>
  );
}
