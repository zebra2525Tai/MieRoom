import Link from "next/link";

// S92 エラー(見つからない)
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">ページが見つかりません</h1>
      <Link
        href="/"
        className="w-fit rounded bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        ホームへ
      </Link>
    </main>
  );
}
