import { LinkButton } from "@/components/ui/button";

// S92 エラー(見つからない)
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <h1 className="text-xl font-bold">ページが見つかりません</h1>
      <LinkButton href="/">ホームへ</LinkButton>
    </main>
  );
}
