"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { MESSAGES, SYSTEM_ERROR_MESSAGE } from "@/lib/messages";

type Answer = { ok: boolean; status: number; message: string | null };

async function post(endpoint: string, body: unknown): Promise<Answer> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data: unknown = await response.json().catch(() => null);
    const message =
      typeof data === "object" && data !== null && "message" in data
        ? String((data as { message: unknown }).message)
        : null;
    return { ok: response.ok, status: response.status, message };
  } catch {
    return { ok: false, status: 0, message: MESSAGES.ME901 };
  }
}

/** Shows what was done on the same screen (MI201 ...) and reads the list again. */
function useDone() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  return (notice: string) => {
    const params = new URLSearchParams(search);
    params.set("notice", notice);
    router.replace(`${pathname}?${params.toString()}`);
    router.refresh();
  };
}

// 承認・却下・取消 (S10, S11). The server checks everything again; the buttons only ask.
export function ReviewButtons({
  id,
  status,
  blocked,
  needsConfirm,
  size = "sm",
}: {
  id: string;
  status: string;
  /** Any reason that stops an approval (ME201〜ME203): 承認 cannot be pressed. */
  blocked: boolean;
  /** MC201: an approved reservation is on the same slots. */
  needsConfirm: boolean;
  /** Compact in table rows; full size, further apart, in cards (touch). */
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const done = useDone();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** For the confirmation window: an error text keeps it open; null closes it. */
  const run = async (endpoint: string, body: unknown, notice: string) => {
    const answer = await post(endpoint, body);
    if (answer.ok) {
      done(notice);
      return null;
    }
    // Somebody else was first (or time passed): read the list again.
    router.refresh();
    return answer.message ?? SYSTEM_ERROR_MESSAGE;
  };

  if (status === "pending") {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <div className={`flex ${size === "md" ? "gap-3" : "gap-2"}`}>
          {needsConfirm ? (
            <ConfirmButton
              size={size}
              variant="primary"
              disabled={blocked}
              message={MESSAGES.MC201}
              onConfirm={() =>
                run(
                  "/teacher/reservations/approve",
                  { id, confirmed: true },
                  "MI201",
                )
              }
            >
              承認
            </ConfirmButton>
          ) : (
            <Button
              size={size}
              variant="primary"
              disabled={blocked || busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                const failure = await run(
                  "/teacher/reservations/approve",
                  { id, confirmed: false },
                  "MI201",
                );
                setBusy(false);
                setError(failure);
              }}
            >
              承認
            </Button>
          )}
          <ConfirmButton
            size={size}
            variant="danger"
            message={MESSAGES.MC202}
            onConfirm={() =>
              run("/teacher/reservations/reject", { id }, "MI202")
            }
          >
            却下
          </ConfirmButton>
        </div>
        {error && (
          <span role="alert" className="text-[11px] text-red-ink">
            {error}
          </span>
        )}
      </div>
    );
  }
  if (status === "approved") {
    return (
      <ConfirmButton
        size={size}
        variant="danger"
        message={MESSAGES.MC203}
        onConfirm={() => run("/teacher/reservations/cancel", { id }, "MI203")}
      >
        取消
      </ConfirmButton>
    );
  }
  return null;
}

// S13 「解除」(MC301 → MI302)
export function ReleaseBlockButton({ id }: { id: string }) {
  const router = useRouter();
  const done = useDone();
  return (
    <ConfirmButton
      size="sm"
      variant="danger"
      message={MESSAGES.MC301}
      onConfirm={async () => {
        const answer = await post("/teacher/blocks/release", { id });
        if (answer.ok) {
          done("MI302");
          return null;
        }
        router.refresh();
        return answer.message ?? SYSTEM_ERROR_MESSAGE;
      }}
    >
      解除
    </ConfirmButton>
  );
}
