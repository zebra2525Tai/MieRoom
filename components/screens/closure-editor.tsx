"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, fieldClass } from "@/components/ui/form";
import { MESSAGES, SYSTEM_ERROR_MESSAGE } from "@/lib/messages";

// S23: 追加・編集の窓と、削除(確認あり). The server checks every value again.

export type EditableClosure = {
  id: string;
  version: string;
  name: string;
  startDate: string;
  endDate: string | null;
  classId: string | null;
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

/** Shows what was done (MI501, MW502) on this screen and reads the list again. */
function useDone() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  return (data: Record<string, unknown>) => {
    const params = new URLSearchParams(search);
    params.set("notice", "MI501");
    const issues = Number(data.exportIssues);
    if (Number.isInteger(issues) && issues > 0) {
      params.set("fix", String(issues));
    } else {
      params.delete("fix");
    }
    router.replace(`${pathname}?${params.toString()}`);
    router.refresh();
  };
}

// 追加 (row null) / 編集 (a row made in the system)
export function ClosureEditButton({
  row,
  classes,
  variant = "default",
  children,
}: {
  row: EditableClosure | null;
  classes: { id: string; name: string }[];
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
            const answer = await send("/admin/closures/save", {
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
          <Field label="開始日" required error={errors.startDate}>
            <input
              type="date"
              name="startDate"
              defaultValue={row?.startDate ?? ""}
              required
              className={fieldClass}
            />
          </Field>
          <Field label="終了日" help="空欄 = 1日だけ" error={errors.endDate}>
            <input
              type="date"
              name="endDate"
              defaultValue={row?.endDate ?? ""}
              className={fieldClass}
            />
          </Field>
          <Field label="名称" required help="20文字まで" error={errors.name}>
            <input
              name="name"
              defaultValue={row?.name ?? ""}
              autoComplete="off"
              className={fieldClass}
            />
          </Field>
          <Field
            label="対象クラス"
            help="空欄 = 全校(営業日から外れます)"
            error={errors.classId}
          >
            <select
              name="classId"
              defaultValue={row?.classId ?? ""}
              className={fieldClass}
            >
              <option value="">全校</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
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

export function ClosureDeleteButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const done = useDone();
  const router = useRouter();
  return (
    <ConfirmButton
      size="sm"
      variant="danger"
      message={MESSAGES.MC505(name)}
      confirmLabel="削除する"
      onConfirm={async () => {
        const answer = await send("/admin/closures/delete", { id });
        if (answer.ok) {
          done(answer.data);
          return null;
        }
        router.refresh();
        return answer.message ?? SYSTEM_ERROR_MESSAGE;
      }}
    >
      削除
    </ConfirmButton>
  );
}
