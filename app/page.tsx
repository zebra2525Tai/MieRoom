import { signOutAction } from "@/app/login/actions";
import { requireUser } from "@/lib/server/session";

const ROLE_LABEL = {
  student: "学生",
  teacher: "先生",
  admin: "時間割管理者",
} as const;

// S02 ホーム(仮)。ログインと役割の確認のため、役割だけを出す。
// 名前は画面に出さない(ログインで届いた氏名は、ログインの確認にだけ使う)。
export default async function HomePage() {
  const user = await requireUser();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold">ミエルーム</h1>
      <p>{ROLE_LABEL[user.role]}としてログインしています。</p>
      <form action={signOutAction}>
        <button
          type="submit"
          className="rounded border border-zinc-400 px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          ログアウト
        </button>
      </form>
    </main>
  );
}
