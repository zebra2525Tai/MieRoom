import Link from "next/link";

// S90 権限がありません。権限のない画面の中身の代わりに、この部品を出す。
export function ForbiddenView() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">この画面を見る権限がありません</h1>
      <Link
        href="/"
        className="w-fit rounded bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        ホームへ
      </Link>
    </main>
  );
}
