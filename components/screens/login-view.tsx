import type { ComponentProps } from "react";
import { Brand } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

// S01 ログイン
export function LoginView({
  message,
  next,
  action,
}: {
  message: string | null;
  next: string;
  action?: ComponentProps<"form">["action"];
}) {
  return (
    <main className="grid min-h-screen bg-white md:grid-cols-[1.1fr_1fr]">
      <section className="flex flex-col justify-center bg-navy px-7 py-8 text-white md:px-[clamp(35px,7vw,110px)] md:py-16">
        <div className="pb-6 md:pb-16">
          <Brand light />
        </div>
        <h1 className="text-[26px] font-semibold leading-relaxed tracking-wide md:text-[clamp(28px,3.1vw,43px)]">
          次の教室も、
          <br />
          先生の居場所も。
        </h1>
        <p className="mt-4 text-xs leading-loose text-[#cfd7ff] md:mt-5 md:text-[13px]">
          学校の予定を、分かりやすく。
          <br />
          教室の使用状況と先生の位置をまとめて確認できます。
        </p>
      </section>
      <section className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[370px]">
          <div className="mb-3.5 text-[11px] font-bold tracking-[0.12em] text-brand">
            ミエルーム
          </div>
          <h2 className="text-[23px] font-bold sm:text-[25px]">ログイン</h2>
          <p className="mb-7 mt-3 text-xs leading-loose text-muted">
            学校のMicrosoftアカウントでログインしてください
          </p>
          {message && (
            <p
              role="alert"
              className="mb-5 rounded-[9px] bg-red-soft px-4 py-3 text-xs text-red-ink"
            >
              {message}
            </p>
          )}
          <form action={action}>
            <input type="hidden" name="next" value={next} />
            <Button type="submit" variant="navy" size="lg">
              <Icon name="shield" />
              Microsoftでログイン
              <Icon name="arrow" size={16} />
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
