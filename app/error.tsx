"use client";

import { LinkButton } from "@/components/ui/button";
import { SYSTEM_ERROR_MESSAGE } from "@/lib/messages";

// S92 エラー(システムのエラー)。内部の情報(エラーの内容、スタック)は出さない。
export default function ErrorPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <h1 className="text-xl font-bold">{SYSTEM_ERROR_MESSAGE}</h1>
      <LinkButton href="/">ホームへ</LinkButton>
    </main>
  );
}
