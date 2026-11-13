"use client";

import { useEffect, useRef, useState } from "react";
import { MonitorInvalid } from "@/components/screens/monitor-invalid";
import { MonitorView } from "@/components/screens/monitor-view";
import { jstClock, secondsUntilNextRefresh } from "@/lib/domain/monitor";

// S30 に、時計と更新をつける。いまの時刻は毎秒進める (データは取りに行かない)。データは、
// 毎日 8:00 と枠の境目の数秒後に取りに行く (1日13回)。取れなかったら 1 分ごとにやり直し、
// 2 分続けて取れなければ、最終更新の時刻を赤にする。前の表示は残す。
// 合言葉が無効にされていたら、次に取りに行ったときに S91 に切り替わる。

type ViewProps = Parameters<typeof MonitorView>[0];
type Payload = Pick<ViewProps, "chips" | "states"> & { updatedAt: string };

const RETRY_MS = 60_000;
const STALE_MS = 120_000;

const isPayload = (value: unknown): value is Payload =>
  typeof value === "object" &&
  value !== null &&
  "chips" in value &&
  "states" in value &&
  typeof (value as { updatedAt?: unknown }).updatedAt === "string";

export function MonitorScreen({
  passphrase,
  initial,
}: {
  passphrase: string;
  initial: Payload;
}) {
  const [data, setData] = useState<Payload>(initial);
  const [now, setNow] = useState(() => new Date(initial.updatedAt));
  const [invalid, setInvalid] = useState(false);
  const [failedSince, setFailedSince] = useState<number | null>(null);
  const failedAt = useRef<number | null>(null);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const schedule = (ms: number) => {
      if (!stopped) timer = setTimeout(load, ms);
    };
    const waitForBoundary = () =>
      schedule(
        secondsUntilNextRefresh(jstClock(new Date()).secondsOfDay) * 1000,
      );

    async function load() {
      try {
        const response = await fetch(
          `/api/monitor/${encodeURIComponent(passphrase)}`,
          { cache: "no-store" },
        );
        if (response.status === 404) {
          if (!stopped) setInvalid(true);
          return;
        }
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok || !isPayload(body)) throw new Error("bad response");
        if (stopped) return;
        failedAt.current = null;
        setFailedSince(null);
        setData(body);
        waitForBoundary();
      } catch {
        if (stopped) return;
        failedAt.current ??= Date.now();
        setFailedSince(failedAt.current);
        schedule(RETRY_MS);
      }
    }

    waitForBoundary();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [passphrase]);

  if (invalid) return <MonitorInvalid />;

  const clock = jstClock(now);
  const updated = jstClock(new Date(data.updatedAt));
  return (
    <MonitorView
      chips={data.chips}
      states={data.states}
      dateText={clock.dateText}
      timeText={clock.timeText}
      updatedText={updated.timeText}
      stale={failedSince !== null && now.getTime() - failedSince >= STALE_MS}
    />
  );
}
