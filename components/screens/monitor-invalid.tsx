// S91 「URLが無効です」だけ。システム名もメニューも出さない (外部設計書 03章 3-6)。
export function MonitorInvalid() {
  return (
    <main className="fixed inset-0 grid place-items-center bg-[#0b1f3a] text-white">
      <p className="text-3xl font-bold">URLが無効です</p>
    </main>
  );
}
