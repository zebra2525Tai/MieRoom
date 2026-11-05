import { redirect } from "next/navigation";
import { LoginView } from "@/components/screens/login-view";
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

  return (
    <LoginView
      message={loginErrorMessage(error)}
      next={next}
      action={signInWithMicrosoft}
    />
  );
}
