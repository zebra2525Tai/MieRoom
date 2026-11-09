"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, fieldClass } from "@/components/ui/form";
import { MESSAGES, SYSTEM_ERROR_MESSAGE } from "@/lib/messages";

// S21: 追加・編集の窓と、無効にする / 有効に戻す. The server checks every value again and
// answers with the words of 10章; this only shows them next to the box they belong to.

type Tab = "classes" | "teachers" | "subjects" | "rooms";
export type EditableRow = {
  id: string;
  version: string;
  name: string;
  homeRoomId?: string;
  startYear?: number;
  endYear?: number | null;
  email?: string | null;
  building?: string | null;
  kind?: "HOMEROOM" | "FREE";
  note?: string | null;
};

type FieldErrors = Record<string, string>;

async function send(
  endpoint: string,
  body: unknown,
): Promise<{
  ok: boolean;
  data: Record<string, unknown>;
  errors: FieldErrors;
  message: string | null;
}> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const parsed: unknown = await response.json().catch(() => null);
    const data =
      typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    const errors: FieldErrors = {};
    if (Array.isArray(data.errors)) {
      for (const item of data.errors as {
        field?: string;
        message?: string;
      }[]) {
        if (item.field && item.message) errors[item.field] ??= item.message;
      }
    }
    return {
      ok: response.ok,
      data,
      errors,
      message:
        typeof data.message === "string"
          ? data.message
          : response.ok || Object.keys(errors).length > 0
            ? null
            : SYSTEM_ERROR_MESSAGE,
    };
  } catch {
    return { ok: false, data: {}, errors: {}, message: MESSAGES.ME901 };
  }
}

/** Shows what was done on this screen (MI501, MW501, MW502) and reads the list again. */
function useDone() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  return (data: Record<string, unknown>) => {
    const params = new URLSearchParams(search);
    params.set("notice", String(data.notice ?? "MI501"));
    if (data.renamed === true) params.set("renamed", "1");
    else params.delete("renamed");
    const issues = Number(data.exportIssues);
    if (Number.isInteger(issues) && issues > 0)
      params.set("fix", String(issues));
    else params.delete("fix");
    router.replace(`${pathname}?${params.toString()}`);
    router.refresh();
  };
}

function Text({
  name,
  label,
  errors,
  defaultValue,
  required = false,
  help,
  inputMode,
}: {
  name: string;
  label: string;
  errors: FieldErrors;
  defaultValue?: string | number | null;
  required?: boolean;
  help?: string;
  inputMode?: "numeric";
}) {
  return (
    <Field label={label} required={required} help={help} error={errors[name]}>
      <input
        name={name}
        defaultValue={defaultValue ?? ""}
        inputMode={inputMode}
        autoComplete="off"
        className={fieldClass}
      />
    </Field>
  );
}

function Fields({
  tab,
  row,
  rooms,
  errors,
  defaultYear,
}: {
  tab: Tab;
  row: EditableRow | null;
  rooms: { id: string; name: string }[];
  errors: FieldErrors;
  defaultYear: number;
}) {
  switch (tab) {
    case "classes":
      return (
        <>
          <Text
            name="name"
            label="クラス名"
            required
            errors={errors}
            defaultValue={row?.name}
          />
          <Field label="ホームルーム教室" required error={errors.homeRoomId}>
            <select
              name="homeRoomId"
              defaultValue={row?.homeRoomId ?? ""}
              className={fieldClass}
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
          <Text
            name="startYear"
            label="開始年度"
            required
            inputMode="numeric"
            errors={errors}
            defaultValue={row?.startYear ?? defaultYear}
          />
          <Text
            name="endYear"
            label="終了年度"
            inputMode="numeric"
            errors={errors}
            defaultValue={row?.endYear}
            help="空欄 = 続く"
          />
        </>
      );
    case "teachers":
      return (
        <>
          <Text
            name="displayName"
            label="時間割での表記"
            required
            errors={errors}
            defaultValue={row?.name}
            help="20文字まで。「各担当」「外部講師」「、」は使えません"
          />
          <Text
            name="email"
            label="メール"
            errors={errors}
            defaultValue={row?.email}
            help="先生としてログインするには必要です"
          />
        </>
      );
    case "subjects":
      return (
        <Text
          name="name"
          label="教科名"
          required
          errors={errors}
          defaultValue={row?.name}
        />
      );
    case "rooms":
      return (
        <>
          <Text
            name="name"
            label="教室名"
            required
            errors={errors}
            defaultValue={row?.name}
            help="全角数字は半角にして保存します"
          />
          <Text
            name="building"
            label="棟・階"
            errors={errors}
            defaultValue={row?.building}
          />
          <Field label="分類" required error={errors.kind}>
            <select
              name="kind"
              defaultValue={row?.kind ?? "FREE"}
              className={fieldClass}
            >
              <option value="HOMEROOM">ホームルーム</option>
              <option value="FREE">空き教室</option>
            </select>
          </Field>
          <Text
            name="note"
            label="備考"
            errors={errors}
            defaultValue={row?.note}
            help="50文字まで"
          />
        </>
      );
  }
}

// 追加 (row null) / 編集 (a row of the list)
export function MasterEditButton({
  tab,
  row,
  rooms,
  defaultYear,
  variant = "default",
  children,
}: {
  tab: Tab;
  row: EditableRow | null;
  rooms: { id: string; name: string }[];
  defaultYear: number;
  variant?: "default" | "primary";
  children: ReactNode;
}) {
  const done = useDone();
  const dialog = useRef<HTMLDialogElement>(null);
  const [opened, setOpened] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);

  return (
    <>
      <Button
        size={row ? "sm" : "md"}
        variant={variant}
        onClick={() => {
          setErrors({});
          setMessage(null);
          setOpened((count) => count + 1); // a fresh form each time
          dialog.current?.showModal();
        }}
      >
        {children}
      </Button>
      <dialog
        ref={dialog}
        aria-label={row ? "編集" : "追加"}
        className="m-auto w-[min(94vw,520px)] rounded-xl border border-line bg-white p-5 text-xs text-ink shadow-xl backdrop:bg-black/40"
      >
        <form
          key={opened}
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            const form = Object.fromEntries(new FormData(event.currentTarget));
            setBusy(true);
            setErrors({});
            setMessage(null);
            const answer = await send("/admin/masters/save", {
              kind: tab,
              ...(row ? { id: row.id, version: row.version } : {}),
              ...form,
            });
            setBusy(false);
            if (answer.ok) {
              dialog.current?.close();
              done(answer.data);
            } else {
              setErrors(answer.errors);
              setMessage(answer.message);
            }
          }}
        >
          <h2 className="text-base font-bold">{row ? "編集" : "追加"}</h2>
          <Fields
            tab={tab}
            row={row}
            rooms={rooms}
            errors={errors}
            defaultYear={defaultYear}
          />
          {message && (
            <p role="alert" className="text-[11px] text-red-ink">
              {message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button onClick={() => dialog.current?.close()} disabled={busy}>
              閉じる
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              保存
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}

// 無効にする (MC501) / 有効に戻す (確認なし)
export function MasterActiveButton({
  tab,
  id,
  name,
  active,
}: {
  tab: Tab;
  id: string;
  name: string;
  active: boolean;
}) {
  const done = useDone();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async (): Promise<string | null> => {
    const answer = await send("/admin/masters/active", {
      kind: tab,
      id,
      active: !active,
    });
    if (answer.ok) {
      done(answer.data);
      return null;
    }
    router.refresh();
    return answer.message ?? SYSTEM_ERROR_MESSAGE;
  };

  return active ? (
    <ConfirmButton
      size="sm"
      variant="danger"
      message={MESSAGES.MC501(name)}
      onConfirm={change}
    >
      無効にする
    </ConfirmButton>
  ) : (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(await change());
          setBusy(false);
        }}
      >
        有効に戻す
      </Button>
      {error && (
        <span role="alert" className="text-[11px] text-red-ink">
          {error}
        </span>
      )}
    </span>
  );
}
