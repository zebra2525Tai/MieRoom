"use client";

import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { MESSAGES, SYSTEM_ERROR_MESSAGE } from "@/lib/messages";

// S07 「取り下げ」(承認待ちのときだけ出す)。MC101 → MI102。すでに対応済みなら ME110。
export function WithdrawButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      size="sm"
      variant="danger"
      message={MESSAGES.MC101}
      onConfirm={async () => {
        try {
          const response = await fetch("/reservations/withdraw", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          });
          const data: unknown = await response.json().catch(() => null);
          if (response.ok) {
            router.replace("/reservations?notice=MI102");
            router.refresh();
            return null;
          }
          // Somebody answered first (or it started): show why, and read the list again.
          router.refresh();
          return typeof data === "object" && data !== null && "message" in data
            ? String((data as { message: unknown }).message)
            : SYSTEM_ERROR_MESSAGE;
        } catch {
          return MESSAGES.ME901;
        }
      }}
    >
      取り下げ
    </ConfirmButton>
  );
}
