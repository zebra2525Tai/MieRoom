import Link from "next/link";

const SCREENS: { title: string; items: [string, string][] }[] = [
  {
    title: "共通・学生",
    items: [
      ["s01", "S01 ログイン"],
      ["s02", "S02 ホーム"],
      ["s03", "S03 時間割(今日)"],
      ["s03?view=week", "S03 時間割(今週)"],
      ["s03?view=month", "S03 時間割(月)"],
      ["s04", "S04 空き教室(カード)"],
      ["s04?layout=table&all=1", "S04 空き教室(時限表)"],
      ["s05", "S05 先生一覧"],
      ["s06", "S06 予約の申請"],
      ["s07", "S07 自分の予約"],
    ],
  },
  {
    title: "先生",
    items: [
      ["s10", "S10 先生ホーム"],
      ["s11", "S11 予約の一覧"],
      ["s12", "S12 代理入力"],
      ["s13", "S13 使用止め"],
      ["s14", "S14 授業の変更"],
      ["s14-add", "S14 授業を足す(補講)"],
    ],
  },
  {
    title: "時間割管理者",
    items: [
      ["s20", "S20 時間割の取り込み"],
      ["s21", "S21 マスタ"],
      ["s22", "S22 紐づけ"],
      ["s23", "S23 休み・行事"],
      ["s24", "S24 CSV書き出し"],
      ["s24-error", "S24 CSV書き出し(エラーあり)"],
      ["s25", "S25 タグ・受信機"],
      ["s26", "S26 削除管理"],
      ["s27", "S27 モニターURL"],
    ],
  },
  { title: "モニター", items: [["s30", "S30 モニター(1920×1080)"]] },
];

export default function DevHome() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">開発用ページ</h1>
      <p className="mt-3 text-xs text-muted">
        ログインなしで画面の見た目を確かめるためのページです。データは架空で、DBには触れません。本番では表示されません。
      </p>
      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        {SCREENS.map((group) => (
          <section key={group.title}>
            <h2 className="mb-2 font-bold">{group.title}</h2>
            <ul className="flex flex-col gap-1.5 text-xs">
              {group.items.map(([href, label]) => (
                <li key={href}>
                  <Link
                    href={`/_dev/${href}`}
                    className="text-brand-dark underline"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
