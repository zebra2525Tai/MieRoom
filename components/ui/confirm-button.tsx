"use client";

import { useRef, useState, type ComponentProps } from "react";
import { Button } from "./button";

// A button that asks first (確認の窓, 6-3): 取り消せない操作の前に出す。
// `onConfirm` returns an error text to keep the window open with it, or null when it is done.

export function ConfirmButton({
  message,
  confirmLabel = "はい",
  cancelLabel = "いいえ",
  onConfirm,
  children,
  ...buttonProps
}: {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => Promise<string | null>;
} & Omit<ComponentProps<typeof Button>, "onClick" | "type">) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    dialog.current?.close();
    setError(null);
  };

  return (
    <>
      <Button {...buttonProps} onClick={() => dialog.current?.showModal()}>
        {children}
      </Button>
      <dialog
        ref={dialog}
        aria-label="確認"
        className="m-auto w-[min(92vw,420px)] rounded-xl border border-line bg-white p-5 text-xs text-ink shadow-xl backdrop:bg-black/40"
      >
        <p className="mb-4 text-[13px] leading-relaxed">{message}</p>
        {error && (
          <p role="alert" className="mb-3 text-[11px] text-red-ink">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button onClick={close} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const failure = await onConfirm();
              setBusy(false);
              if (failure === null) dialog.current?.close();
              else setError(failure);
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </dialog>
    </>
  );
}
