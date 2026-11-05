import { LinkButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

// S90 権限がありません。権限のない画面の中身の代わりに、この部品を出す。
export function ForbiddenView() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-16 text-center">
      <Icon name="shield" size={36} className="text-muted" />
      <h1 className="text-xl font-bold">この画面を見る権限がありません</h1>
      <LinkButton href="/">ホームへ</LinkButton>
    </div>
  );
}
