import { redirect } from "next/navigation";
import { safeRedirectPath } from "@/lib/auth/policy";
import { loginErrorMessage } from "@/lib/messages";
import { getCurrentUser } from "@/lib/server/session";
import { signInWithMicrosoft } from "./actions";

// S01 ログイン
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const next = safeRedirectPath(
    typeof params.next === "string" ? params.next : undefined,
  );

  // Already signed in: go on to where the person was heading.
  if (!error && (await getCurrentUser())) redirect(next);

  const message = loginErrorMessage(error);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold">ミエルーム</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        学校のMicrosoftアカウントでログインしてください
      </p>
      {message && (
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-4 py-3 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {message}
        </p>
      )}
      <form action={signInWithMicrosoft}>
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          className="w-full rounded bg-zinc-900 px-4 py-3 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Microsoftでログイン
        </button>
      </form>
    </main>
  );
}
