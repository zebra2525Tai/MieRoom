"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { send, useDone } from "@/components/screens/access-editors";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { fieldClass } from "@/components/ui/form";
import { MONITOR_NAME_MAX } from "@/lib/domain/monitor";
import { MESSAGES } from "@/lib/messages";

// S27 モニターURL: 追加、URL のコピー、合言葉を変える (MC503)、無効にする / 有効に戻す。
// サーバーが、権限と入力をもう一度確かめる。ここで出す文は、サーバーの答え。

/** 追加: 名前 (必須、20文字まで) を入れると、合言葉を作って URL を出す。 */
export function MonitorAddForm() {
  const done = useDone();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mb-4 flex flex-wrap items-end gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError(null);
        const answer = await send("/admin/monitors/add", { name });
        setBusy(false);
        if (answer.ok) {
          setName("");
          done(answer.notice);
        } else {
          setError(answer.message);
        }
      }}
    >
      <label className="flex flex-col gap-1 text-xs font-semibold">
        名前
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={MONITOR_NAME_MAX}
          autoComplete="off"
          required
          className={`${fieldClass} h-[34px] w-[200px]`}
          placeholder="例: 1階の玄関"
        />
      </label>
      <Button type="submit" size="sm" variant="primary" disabled={busy}>
        追加する
      </Button>
      {error && (
        <span role="alert" className="basis-full text-[11px] text-red-ink">
          {error}
        </span>
      )}
    </form>
  );
}

/** URL (合言葉つき) と、コピーのボタン。この画面でだけ見られる。 */
export function MonitorUrl({ passphrase }: { passphrase: string }) {
  // The address of this site: known only in the browser (empty while rendering on the server).
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const [copied, setCopied] = useState(false);
  const url = `${origin}/monitor/${passphrase}`;
  return (
    <span className="inline-flex items-center gap-2">
      <code className="max-w-[340px] truncate rounded bg-[#f1f3f8] px-1.5 py-0.5 text-[11px]">
        {url}
      </code>
      <Button
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "コピーしました" : "コピー"}
      </Button>
    </span>
  );
}

/** 合言葉を変える: 確認 (MC503) のあと、新しい URL を出す。古い URL はすぐに使えなくなる。 */
export function MonitorRotateButton({ id }: { id: string }) {
  const done = useDone();
  return (
    <ConfirmButton
      size="sm"
      message={MESSAGES.MC503}
      onConfirm={async () => {
        const answer = await send("/admin/monitors/rotate", { id });
        if (answer.ok) {
          done(answer.notice);
          return null;
        }
        return answer.message;
      }}
    >
      合言葉を変える
    </ConfirmButton>
  );
}

/** 無効にする / 有効に戻す。無効の URL は「URLが無効です」(S91) になる。 */
export function MonitorActiveButton({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  const done = useDone();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant={active ? "danger" : "default"}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const answer = await send("/admin/monitors/active", {
            id,
            active: !active,
          });
          setBusy(false);
          if (answer.ok) done(answer.notice);
          else {
            setError(answer.message);
            router.refresh();
          }
        }}
      >
        {active ? "無効にする" : "有効に戻す"}
      </Button>
      {error && (
        <span role="alert" className="text-[11px] text-red-ink">
          {error}
        </span>
      )}
    </span>
  );
}
