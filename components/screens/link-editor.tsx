"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, fieldClass } from "@/components/ui/form";
import { MESSAGES, SYSTEM_ERROR_MESSAGE } from "@/lib/messages";

// S22: 追加の窓と、行ごとの削除(MC504). The server checks every choice again.

type Tab = "subjects" | "teachers" | "rooms";
type Choice = { id: string; name: string };

export type LinkChoices = {
  /** Active subjects that are not yet the class's: for クラスの教科 */
  newSubjects: Choice[];
  /** The class's subjects: for 教科の講師 and 教科の教室 */
  classSubjects: Choice[];
  teachers: Choice[];
  rooms: Choice[];
};

async function send(
  endpoint: string,
  body: unknown,
): Promise<{
  ok: boolean;
  data: Record<string, unknown>;
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
    return {
      ok: response.ok,
      data,
      message:
        typeof data.message === "string"
          ? data.message
          : response.ok
            ? null
            : SYSTEM_ERROR_MESSAGE,
    };
  } catch {
    return { ok: false, data: {}, message: MESSAGES.ME901 };
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
    if (Number.isInteger(issues) && issues > 0)
      params.set("fix", String(issues));
    else params.delete("fix");
    router.replace(`${pathname}?${params.toString()}`);
    router.refresh();
  };
}

export function LinkAddButton({
  tab,
  classId,
  choices,
}: {
  tab: Tab;
  classId: string;
  choices: LinkChoices;
}) {
  const done = useDone();
  const dialog = useRef<HTMLDialogElement>(null);
  const [opened, setOpened] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subjects =
    tab === "subjects" ? choices.newSubjects : choices.classSubjects;
  return (
    <>
      <Button
        variant="primary"
        onClick={() => {
          setError(null);
          setOpened((count) => count + 1);
          dialog.current?.showModal();
        }}
      >
        追加
      </Button>
      <dialog
        ref={dialog}
        aria-label="追加"
        className="m-auto w-[min(94vw,480px)] rounded-xl border border-line bg-white p-5 text-xs text-ink shadow-xl backdrop:bg-black/40"
      >
        <form
          key={opened}
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            const form = Object.fromEntries(new FormData(event.currentTarget));
            setBusy(true);
            setError(null);
            const answer = await send("/admin/links/add", {
              tab,
              classId,
              ...form,
            });
            setBusy(false);
            if (answer.ok) {
              dialog.current?.close();
              done(answer.data);
            } else {
              setError(answer.message);
            }
          }}
        >
          <h2 className="text-base font-bold">追加</h2>
          <Field label="教科" required>
            <select
              name="subjectId"
              defaultValue=""
              required
              className={fieldClass}
            >
              <option value="" disabled>
                選んでください
              </option>
              {subjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          {tab === "teachers" && (
            <Field label="講師" required>
              <select
                name="teacherId"
                defaultValue=""
                required
                className={fieldClass}
              >
                <option value="" disabled>
                  選んでください
                </option>
                <option value="each">各担当</option>
                {choices.teachers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {tab === "rooms" && (
            <Field label="教室" required>
              <select
                name="roomId"
                defaultValue=""
                required
                className={fieldClass}
              >
                <option value="" disabled>
                  選んでください
                </option>
                <option value="none">ー(教室未定)</option>
                {choices.rooms.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {tab !== "subjects" && subjects.length === 0 && (
            <p className="text-[11px] text-muted">
              先に「クラスの教科」で、このクラスの教科を追加してください。
            </p>
          )}
          {error && (
            <p role="alert" className="text-[11px] text-red-ink">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button onClick={() => dialog.current?.close()} disabled={busy}>
              閉じる
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              追加する
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}

// 行の削除。ツールへの影響を知らせる確認の窓(MC504)を出す。
export function LinkRemoveButton({
  tab,
  classId,
  subjectId,
  targetKey,
}: {
  tab: Tab;
  classId: string;
  subjectId: string;
  targetKey: string;
}) {
  const done = useDone();
  const router = useRouter();
  return (
    <ConfirmButton
      size="sm"
      variant="danger"
      message={MESSAGES.MC504}
      confirmLabel="削除する"
      onConfirm={async () => {
        const answer = await send("/admin/links/remove", {
          tab,
          classId,
          subjectId,
          targetKey,
        });
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
