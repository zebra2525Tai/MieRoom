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
    // Below lg: stacked, a compact navy band on top and the form right below it;
    // both are 370px wide and centred, so their edges line up.
    // From lg: two halves, the copy sits toward the middle (right side of the navy half).
    <main className="grid min-h-screen grid-rows-[auto_1fr] bg-white lg:grid-cols-[1.1fr_1fr] lg:grid-rows-none">
      <section className="flex flex-col justify-center bg-navy px-6 py-8 text-white sm:py-12 lg:px-[clamp(35px,6vw,120px)] lg:py-16">
        <div className="mx-auto w-full max-w-[370px] lg:mr-0 lg:max-w-[520px]">
          <div className="pb-6 lg:pb-16">
            <Brand light />
          </div>
          <h1 className="text-[26px] font-semibold leading-relaxed tracking-wide sm:text-[30px] lg:text-[clamp(28px,3.1vw,43px)]">
            次の教室も、
            <br />
            先生の居場所も。
          </h1>
          <p className="mt-4 text-xs leading-loose text-[#cfd7ff] lg:mt-5 lg:text-[13px]">
            学校の予定を、分かりやすく。
            <br />
            教室の使用状況と先生の位置をまとめて確認できます。
          </p>
        </div>
      </section>
      <section className="flex items-start justify-center px-6 py-10 sm:py-14 lg:items-center lg:py-10">
        <div className="w-full max-w-[370px]">
          {/* Below lg the brand is right above, so the name is not repeated. */}
          <div className="mb-3.5 hidden text-[11px] font-bold tracking-[0.12em] text-brand lg:block">
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
