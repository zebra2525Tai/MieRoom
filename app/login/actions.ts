"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeRedirectPath } from "@/lib/auth/policy";
import { getAuth } from "@/lib/server/auth";

// Starts the Microsoft sign-in (S01). The place to return to is checked so it
// can only be a path on this site.
export async function signInWithMicrosoft(formData: FormData) {
  const next = safeRedirectPath(String(formData.get("next") ?? ""));
  const result = await getAuth().api.signInSocial({
    body: {
      provider: "microsoft",
      callbackURL: next,
      errorCallbackURL: "/login",
    },
    headers: await headers(),
  });
  if (!result.url) redirect("/login?error=ME003");
  redirect(result.url);
}

export async function signOutAction() {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/login");
}
