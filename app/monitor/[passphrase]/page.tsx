import type { Metadata } from "next";
import { MonitorInvalid } from "@/components/screens/monitor-invalid";
import { MonitorScreen } from "@/components/screens/monitor-screen";
import { findActiveMonitor, loadMonitorScreen } from "@/lib/server/monitor";

// S30 モニター。ログインなし。URL の合言葉が合っていて有効なときだけ、教室の使用状況を出す。
// 違う・無効なら、S91 「URLが無効です」だけ (何も漏らさない)。

export const metadata: Metadata = {
  title: "ミエルーム",
  robots: { index: false, follow: false },
};

export default async function MonitorPage({
  params,
}: PageProps<"/monitor/[passphrase]">) {
  const { passphrase } = await params;
  if ((await findActiveMonitor(passphrase)) === null) return <MonitorInvalid />;
  const screen = await loadMonitorScreen();
  return (
    <MonitorScreen
      passphrase={passphrase}
      initial={{
        chips: screen.chips,
        states: screen.states,
        updatedAt: screen.updatedAt,
      }}
    />
  );
}
