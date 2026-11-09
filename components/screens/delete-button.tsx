"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/form";
import { MESSAGES, SYSTEM_ERROR_MESSAGE } from "@/lib/messages";

type Kind = "classes" | "teachers" | "subjects" | "rooms";

// S26 「削除」→ MC502 の窓: 戻せない注意、影響、名前の入力。名前が合うまで押せない。
// 5分以内にログインし直していなければ(ME006)、ログインし直して、この画面に戻る。
export function DeleteButton({
  kind,
  id,
  name,
  impacts,
}: {
  kind: Kind;
  id: string;
  name: string;
  impacts: string[];
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim() === name;

  const back = `/admin/delete?tab=${kind}`;
  return (
    <>
      <Button
        size="sm"
        variant="danger"
        onClick={() => {
          setTyped("");
          setError(null);
          dialog.current?.showModal();
        }}
      >
        削除
      </Button>
      <dialog
        ref={dialog}
        aria-label="削除の確認"
        className="m-auto w-[min(94vw,480px)] rounded-xl border border-line bg-white p-5 text-xs text-ink shadow-xl backdrop:bg-black/40"
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy || !matches) return;
            setBusy(true);
            setError(null);
            try {
              const response = await fetch("/admin/delete/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ kind, id, name: typed }),
              });
              const data: unknown = await response.json().catch(() => null);
              const record =
                typeof data === "object" && data !== null
                  ? (data as Record<string, unknown>)
                  : {};
              if (response.ok) {
                dialog.current?.close();
                router.replace(`${back}&notice=MI503`);
                router.refresh();
                return;
              }
              // ME006: sign in again, and come back to this screen.
              if (record.reauth === true) {
                router.push(
                  `/login?error=ME006&next=${encodeURIComponent(back)}`,
                );
                return;
              }
              setError(
                typeof record.message === "string"
                  ? record.message
                  : SYSTEM_ERROR_MESSAGE,
              );
              router.refresh();
            } catch {
              setError(MESSAGES.ME901);
            }
            setBusy(false);
          }}
        >
          <p className="text-[13px] leading-relaxed">
            {MESSAGES.MC502(name, impacts.join("、") || "なし")}
          </p>
          <input
            aria-label="削除する名前"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            placeholder={name}
            className={fieldClass}
          />
          {typed !== "" && !matches && (
            <p role="alert" className="text-[11px] text-red-ink">
              {MESSAGES.ME511}
            </p>
          )}
          {error && (
            <p role="alert" className="text-[11px] text-red-ink">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button onClick={() => dialog.current?.close()} disabled={busy}>
              やめる
            </Button>
            <Button type="submit" variant="primary" disabled={busy || !matches}>
              削除する
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
