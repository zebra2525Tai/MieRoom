"use strict";
const fs = require("fs");
const path = require("path");
const L = require("./lib.cjs");
const { ROOT, vars: V } = require("./data.cjs");
const { h1, h2, h3, p, bullets, numbered, table, note } = L;
const git = require("./data.cjs").git;
const lic = require("./data.cjs").lic;

const meta = {
  no: "MR-06",
  title: "外部資料・AI 利用記録",
  subtitle: "参考資料、ライブラリとライセンス、素材、AI の利用方法と記録",
  version: "1.0",
  date: V.DATE,
  file: "06_外部資料・AI利用記録.docx",
};

// ---- ライブラリ(package.json から自動で作る) ----
const pkg = JSON.parse(
  fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
);
const PURPOSE = {
  "@date-fns/tz": "日本時間の計算(締め・年度の判定)",
  "@prisma/adapter-neon": "Neon(PostgreSQL)への接続(アプリ)",
  "@prisma/client": "データベースへのアクセス(型つき)",
  "better-auth": "ログイン(Microsoft)とセッション",
  "date-fns": "日付の計算",
  fflate: "ZIP の作成(8 つの CSV の書き出し)",
  next: "Web フレームワーク(画面とサーバーの処理)",
  papaparse: "CSV の読み取り",
  react: "画面の部品",
  "react-dom": "画面の部品(ブラウザ)",
  "server-only": "サーバー専用コードが、ブラウザに混ざらないようにする",
  zod: "入力の検証",
  "@prisma/adapter-pg": "結合テスト用の DB 接続(開発用)",
  "@tailwindcss/turbopack": "CSS のビルド",
  "@types/node": "型定義(Node.js)",
  "@types/papaparse": "型定義(papaparse)",
  "@types/pg": "型定義(pg)",
  "@types/react": "型定義(React)",
  "@types/react-dom": "型定義(React DOM)",
  eslint: "コードの静的解析",
  "eslint-config-next": "ESLint の Next.js 用の設定",
  "eslint-config-prettier": "ESLint と Prettier の衝突を防ぐ",
  pg: "結合テスト用の PostgreSQL ドライバ(開発用)",
  prettier: "コードの書式",
  prisma: "データベースの定義・表の作成のコマンド",
  tailwindcss: "CSS(スタイル)",
  tsx: "スクリプトの実行(初期データ投入など)",
  typescript: "型チェック・言語",
  vitest: "テスト",
  docx: "提出用の Word 書類の作成(`npm run docs:build`)",
};
const libRows = [];
for (const [sect, obj] of [
  ["実行", pkg.dependencies],
  ["開発", pkg.devDependencies],
]) {
  for (const name of Object.keys(obj)) {
    let l = "?",
      v = "";
    try {
      const q = JSON.parse(
        fs.readFileSync(
          path.join(ROOT, "node_modules", name, "package.json"),
          "utf8",
        ),
      );
      l =
        typeof q.license === "string"
          ? q.license
          : (q.license && q.license.type) || "?";
      v = q.version;
    } catch {}
    libRows.push([sect, name, v, l, PURPOSE[name] || ""]);
  }
}
const licRows = lic.out.map((o) => [o.license, String(o.count)]);

const REFS = [
  [
    "Vercel Hobby plan deployment blocked because commit author lacks access",
    "Vercel Community",
    "https://community.vercel.com/t/vercel-hobby-plan-deployment-blocked-because-commit-author-lacks-access/35446",
    "無料プランのデプロイの制限の確認",
  ],
  [
    "Vercel Hobby Plan",
    "Vercel 公式",
    "https://vercel.com/docs/plans/hobby",
    "無料プランの条件",
  ],
  [
    "Vercel: Node.js versions",
    "Vercel 公式",
    "https://vercel.com/docs/concepts/node-js-versions",
    "Node.js の版の選定",
  ],
  [
    "Deploying Git Repositories with Vercel",
    "Vercel 公式",
    "https://vercel.com/docs/git",
    "Git 連携のデプロイ",
  ],
  [
    "Troubleshoot project collaboration",
    "Vercel 公式",
    "https://vercel.com/docs/deployments/troubleshoot-project-collaboration",
    "共同作業の制限",
  ],
  [
    "Usage & Pricing for Cron Jobs",
    "Vercel 公式",
    "https://vercel.com/docs/cron-jobs/usage-and-pricing",
    "定期実行の制限",
  ],
  [
    "Prisma ORM release status",
    "Prisma 公式",
    "https://www.prisma.io/docs/orm/release-status",
    "Prisma の版の選定(7 に固定)",
  ],
  [
    "Prisma changelog 2026-10-02: Prisma ORM 8",
    "Prisma 公式",
    "https://www.prisma.io/changelog/2026-10-02",
    "Prisma 8 の状況の確認",
  ],
  [
    "Upgrade to Prisma ORM 7",
    "Prisma 公式",
    "https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7",
    "Prisma 7 の使い方",
  ],
  [
    "Next.js with Prisma 7",
    "Prisma 公式",
    "https://www.prisma.io/docs/guides/v7/frameworks/nextjs",
    "Next.js との組み合わせ",
  ],
  [
    "Cannot find module '@prisma/client-…'(Issue #29025)",
    "Prisma GitHub",
    "https://github.com/prisma/prisma/issues/29025",
    "既知のエラーと回避の確認",
  ],
  [
    "Connect from Prisma to Neon",
    "Neon 公式",
    "https://neon.com/docs/guides/prisma",
    "Neon への接続の方法",
  ],
  ["Neon pricing", "Neon 公式", "https://neon.com/pricing", "無料枠の確認"],
  [
    "Neon plans / History window / Manage roles / Free plan limits",
    "Neon 公式",
    "https://neon.com/docs/introduction/plans ほか(neon.com/docs/postgres/backup-restore/history-window、neon.com/docs/manage/roles、neon.com/faqs/free-plan-limits-and-quotas)",
    "バックアップ・ブランチ・ロールの仕様、無料枠の確認",
  ],
  [
    "How to upgrade to version 16",
    "Next.js 公式",
    "https://nextjs.org/docs/app/guides/upgrading/version-16",
    "Next.js 16 への対応(`proxy.ts` など)",
  ],
  [
    "serverExternalPackages",
    "Next.js 公式",
    "https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages",
    "サーバー側の外部パッケージの扱い",
  ],
  [
    "Better Auth: Next.js integration",
    "Better Auth 公式",
    "https://better-auth.com/docs/integrations/next.md",
    "ログインの組み込み",
  ],
  [
    "Better Auth: Microsoft",
    "Better Auth 公式",
    "https://better-auth.com/docs/authentication/microsoft.md",
    "Microsoft ログインの設定",
  ],
  [
    "Better Auth: Prisma adapter",
    "Better Auth 公式",
    "https://better-auth.com/docs/adapters/prisma.md",
    "Prisma との連携",
  ],
  [
    "date-fns v4.0 with time zone support",
    "date-fns 公式ブログ",
    "https://blog.date-fns.org/v40-with-time-zone-support/",
    "日本時間の扱い",
  ],
  [
    "Manage App Audience",
    "Google Cloud 公式",
    "https://support.google.com/cloud/answer/15549945",
    "(Google ログインの検討)今は使っていない",
  ],
  [
    "About protected branches",
    "GitHub 公式",
    "https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches",
    "ブランチ保護の検討",
  ],
  [
    "About permissions and visibility of forks",
    "GitHub 公式",
    "https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/about-permissions-and-visibility-of-forks",
    "フォークの権限の確認",
  ],
];

const byDay = Object.entries(git.byDay)
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([d, n]) => [d, String(n)]);

const body = [
  h1("1. この書類について"),
  p(
    "ミエルームの開発で使った、**外部の資料・ライブラリ・素材・サービス**と、**AI の利用**を記録する。出典と利用条件を明らかにし、AI をどう使い、人がどう確かめたかを示すことが目的である。",
  ),
  note(
    "接続文字列・鍵などの秘密の値は、本書に書かない。AI の利用記録は、Git の履歴(コミット)、Notion の更新履歴、Claude Code の会話の記録から確認できる範囲で書いた。",
  ),

  h1("2. 外部資料の利用記録"),
  h2("2-1. 利用の方針"),
  bullets([
    "技術の選定と使い方は、**公式ドキュメントを優先**し、版は、公開されている情報で確かめる(Prisma 8 が正式版の前の候補で、使い方が合わないため 7 に固定した、など)。",
    "使うライブラリは、ライセンスを確認する。実行用の部品はすべて MIT または Apache-2.0。",
    "外部のコードを、そのまま転載していない。ライブラリの公式の手順(設定の書き方など)に沿って、設定した箇所がある。",
    "デモのデータは、すべて架空のものを、プログラムで作った。実在の人・学校のデータは、使っていない。",
  ]),
  h2("2-2. 参考にした資料"),
  ...table(["名称", "提供元", "URL", "用途"], REFS, [26, 12, 40, 22], {
    size: 15,
  }),
  p(
    "このほか、**ハード担当**が作成した依頼文書「教員位置情報連携 API 要件定義メモ(版 1.0)」に合わせて、位置の受け口(IF01)を設計した。ハード側のコード(ESP32)は、ハード担当が作成したもので、本リポジトリには含まれない。",
  ),
  h2("2-3. ライブラリとライセンス"),
  p(
    "直接使っているライブラリ(`package.json`)と、そのライセンスを示す。この表は、`package.json` と、インストール済みの各パッケージの情報から、自動で作成した。",
  ),
  ...table(
    ["区分", "名称", "版", "ライセンス", "用途"],
    libRows,
    [8, 24, 12, 14, 42],
    { size: 15 },
  ),
  h3("間接的に入るパッケージを含む、ライセンスの内訳"),
  p(
    `依存関係をたどって入るパッケージを含め、インストールされているパッケージは ${lic.total} 個ある(\`package-lock.json\` に、すべての名前と版が記録されている)。ライセンスの内訳は次のとおり。`,
  ),
  ...table(["ライセンス", "パッケージ数"], licRows, [70, 30], { size: 16 }),
  h3("条件に注意が必要なもの"),
  ...table(
    ["パッケージ", "ライセンス", "使い方", "対応"],
    [
      [
        "lightningcss(Tailwind の部品)",
        "MPL-2.0",
        "CSS のビルドの道具(開発・ビルド時のみ)",
        "改変せずに利用。MPL はファイル単位の条件のため、影響は限定的",
      ],
      [
        "axe-core(ESLint の部品)",
        "MPL-2.0",
        "アクセシビリティの静的解析(開発時のみ)",
        "同上",
      ],
      [
        "@img/sharp-win32-x64(Next.js の画像処理)",
        "Apache-2.0 AND LGPL-3.0-or-later",
        "画像処理のライブラリ(libvips)の実行用バイナリ。Windows 版",
        "改変せず、別のファイルとして利用(LGPL の条件に合う)。本システムは、画像の最適化機能を、使っていない",
      ],
      [
        "elkjs(Prisma の開発用ツール)",
        "EPL-2.0",
        "開発用ツールの内部",
        "改変せずに利用。開発時のみ",
      ],
      [
        "caniuse-lite",
        "CC-BY-4.0",
        "対応ブラウザのデータ(ビルドの道具)",
        "帰属の表示が条件。データは、開発・ビルド時のみ",
      ],
      [
        "argparse",
        "Python-2.0",
        "コマンドの引数の解析(開発の道具の内部)",
        "改変せずに利用。開発時のみ",
      ],
    ],
    [26, 20, 28, 26],
    { size: 15 },
  ),
  note(
    "上の表のライセンスは、各パッケージの `package.json` に書かれた表記による。提出前に、ライセンスの全文の確認が必要な場合は、`node_modules/<名前>/LICENSE` を参照する。",
  ),
  h2("2-4. 外部サービス"),
  ...table(
    ["サービス", "用途", "利用条件・注意"],
    [
      [
        "Vercel(Hobby・無料)",
        "アプリの公開",
        "個人の非営利の利用に限る(卒業制作は問題ない。卒業後に学校が業務で使い続けるなら、有料プランか学校側の環境が必要)",
      ],
      [
        "Neon(無料)",
        "データベース",
        "計算時間は月 100 CU 時間、5 分使われないと自動停止。時点復元は 6 時間",
      ],
      [
        "GitHub(公開リポジトリ)",
        "ソースコードの管理、自動チェック(Actions)、不具合報告(Issues)",
        "公開のため、Actions は無制限。秘密の値は入れない",
      ],
      [
        "Microsoft Entra ID",
        "ログイン(アプリ登録)",
        "学校のテナントに登録できないため、自分のテナントに「複数の組織」で登録。学校のアカウントが、利用者自身の同意で通る。クライアントシークレットの期限は約 3 か月",
      ],
      [
        "Notion",
        "設計・方針・運用の文書",
        "原本。Claude からの更新は、Notion の連携機能を使う",
      ],
      ["Claude(Anthropic)", "AI(次章)", "Claude Code を利用"],
    ],
    [24, 30, 46],
  ),
  h2("2-5. 素材"),
  ...table(
    ["素材", "出典・作成", "利用条件"],
    [
      [
        "アプリのアイコン(`brand/*.svg`、`app/icon.svg`、`app/apple-icon.png`、`app/favicon.ico`)",
        "AI(Claude)が、設計者の指示で作成した(2026-11-05。扉の形のアイコン)。外部の素材は流用していない",
        "本プロジェクトの成果物。AI が生成したものを、設計者が確認して採用した",
      ],
      [
        "文字(フォント)",
        "CSS で、`Noto Sans JP` などを指定(端末にあれば使う)。フォントのファイルは、同梱していない",
        "同梱していないため、再配布の条件は発生しない",
      ],
      [
        "`public/` の SVG(file、globe、next、vercel、window)",
        "Next.js のひな形(create-next-app)が作るもの。コードからは参照していない(未使用)",
        "Next.js のひな形(MIT)。不要なら削除してよい",
      ],
      [
        "デモデータ(`demo-data/`)",
        "`scripts/demo-data` のプログラムで作った架空のデータ",
        "実在の人・学校とは無関係",
      ],
    ],
    [34, 40, 26],
  ),

  h1("3. AI の利用記録"),
  h2("3-1. 方針と役割分担"),
  p(
    "このシステムは、**AI コーディング**(AI がコードと文書を書き、人が設計・判断・確認をする)で作った。AI は、人の指示を実現する道具であり、設計の決定と、成果物の責任は、人(設計者)にある。",
  ),
  ...table(
    ["役割", "人(設計者)", "AI(Claude Code)"],
    [
      [
        "要件・設計",
        "目的・範囲・方針を決める。設計書(Notion)を確認し、決定する",
        "設計書の下書き、調査(公式ドキュメント)、選択肢と根拠の提示、設計書とコードの突き合わせ",
      ],
      [
        "実装",
        "変更の内容を確認し、許可する",
        "コードの作成・修正。変更の前に、何をどう変えるかを伝える",
      ],
      [
        "テスト",
        "テストの方針と完了基準を決める",
        "テストの設計・作成・実行。結果を、通らなかったものも含めて報告する",
      ],
      ["文書", "内容を確認する", "Notion の更新、本書類(Word)の作成"],
      [
        "運用",
        "DB・GitHub・Notion への変更を許可する",
        "Git の操作(コミット・push)、DB への書き込み(いずれも許可を得てから)",
      ],
    ],
    [16, 40, 44],
  ),
  h2("3-2. 利用したツール"),
  ...table(
    ["ツール", "提供元", "用途", "モデル", "期間"],
    [
      [
        "Claude Code(コマンドライン・VS Code 拡張)",
        "Anthropic",
        "コードの作成・修正、テスト、Git の操作、調査、文書の作成",
        "Claude Sonnet 5.5(コミットの共同作者の記載 {{TR_SONNET}} 件)、Claude Opus 5.5({{TR_OPUS}} 件)",
        `${git.first} 〜 ${git.last}`,
      ],
      [
        "Claude の連携機能(Notion・GitHub・Web 検索)",
        "Anthropic / Notion / GitHub",
        "Notion の読み書き、GitHub のブランチ・PR の確認、公式ドキュメントの検索",
        "同上",
        "同上",
      ],
    ],
    [24, 14, 30, 20, 12],
    { size: 16 },
  ),
  h2("3-3. AI の利用範囲"),
  ...table(
    ["工程", "AI にさせたこと", "成果物"],
    [
      [
        "設計",
        "外部設計書・詳細設計書・テスト設計書の作成と更新。設計と実装の突き合わせ",
        "Notion の設計書(外部設計書 版 0.9 ほか)",
      ],
      [
        "実装",
        "Next.js のアプリ、データベースの定義、ログイン、時間割の取り込み、予約、マスタの管理、削除管理、位置の受け口、テスト用の基盤",
        "リポジトリのコード(約 {{SRC}} 行)",
      ],
      [
        "テスト",
        "単体テスト・結合テストの作成と実行、結果の報告、不具合の発見",
        "テスト(約 {{TESTLINES}} 行)、確認結果",
      ],
      [
        "文書",
        "Notion の運用資料、手順書、チェックシート、本書類(Word)",
        "Notion のページ、本書類",
      ],
      ["素材", "アプリのアイコン(SVG)の作成", "`brand/`、`app/icon.svg`"],
      [
        "調査",
        "ライブラリ・サービスの比較、制限(無料枠など)の確認",
        "開発環境まとめ(Notion)",
      ],
    ],
    [14, 56, 30],
  ),
  h2("3-4. AI への作業の決まり(`CLAUDE.md`)"),
  p(
    "リポジトリの `CLAUDE.md` に、AI への決まりを書き、毎回、従わせている。要点は次のとおり。",
  ),
  ...numbered([
    "既存のコード、Notion、GitHub(PR・コメント・push など)を**変更する前に、何をどう変えるかを伝えて、必ず許可を取る**。読むだけの作業は、確認しなくてよい。",
    "プロジェクトに関わる作業・質問では、毎回、Notion の方針を、最新の状態で読み直す。前に読んだ内容で済ませない。",
    "方針・仕様は、Notion を基準にする。食い違うときは、外部設計書 > システム仕様書 > CSV 連携仕様書の順で優先する。",
    "方針は絶対ではない。より良い案や、困る点、決まっていない判断に気づいたら、**勝手に決めず、根拠と案を添えて相談する**。決まった内容を Notion に反映するかも確認する。",
    "何かを作るときは、「仕様」「動作」「見直し」の 3 つで確認してから、結果を返す。結果は、「作ったもの」「確かめたこととその結果」「残っている点」の順に報告し、**通らなかった確認も隠さない**。",
    "セキュリティは高めを標準にする(権限の確認はサーバー側、入力は zod で検証、秘密の値はサーバーだけ、クライアントには必要な分だけ、セキュリティヘッダー、エラーに内部の情報を出さない)。",
  ]),
  h2("3-5. 記録の証跡"),
  ...table(
    ["証跡", "内容"],
    [
      [
        "Git のコミット",
        `全 ${git.total} コミット(${git.first} 〜 ${git.last})のうち、{{TR_ALL}} 件に、共同作者として \`Co-Authored-By: Claude …\` の記載がある(Claude Sonnet 5.5 が {{TR_SONNET}} 件、Claude Opus 5.5 が {{TR_OPUS}} 件)。コミットメッセージに、変更の理由を書いている`,
      ],
      [
        "Claude Code の会話の記録",
        "セッションごとの記録が、利用者の PC に保存されている。提出が必要なときは、抜粋を提出できる",
      ],
      [
        "Notion の更新履歴",
        "設計書・運用資料の更新が、日時つきで残る。AI が更新したページは、Notion の連携を通している",
      ],
      [
        "自動チェックの結果",
        "型・書き方・テスト・ビルドの結果(コマンドの出力)。通らなかった結果も、そのまま報告した",
      ],
    ],
    [24, 76],
  ),
  p("日ごとのコミット数(開発期間の目安)は次のとおり。"),
  ...table(["日付", "コミット数"], byDay, [50, 50]),
  h2("3-6. 人による確認と、AI の誤りの訂正"),
  p(
    "AI の出力は、誤りを含みうる。次の例のように、テスト・見直し・人の指摘で、誤りを見つけて直した。誤りを隠さず、記録に残す。",
  ),
  ...table(
    ["場面", "AI の誤り・不十分な点", "見つけ方", "訂正"],
    [
      [
        "予約の入り口の応答(2026-11-10)",
        "管理者の入り口と書き出しが、ログインが切れたときに、「権限がありません」を返していた(他の入り口とは食い違い)",
        "権限の表を書いて、入り口ごとの応答を比べた",
        "「ログインの有効期限が切れました」に統一。回帰テストを追加",
      ],
      [
        "テスト設計(2026-11-10)",
        "他人の予約の取り下げの期待結果を、ME110 と書いたが、実装は 404(予約の有無を教えない)",
        "結合テストを作って、実際の動きと比べた",
        "実装が正しいと判断し、設計書を直した",
      ],
      [
        "テスト設計(2026-11-10)",
        "追加するケースの件数の集計を、38 件と数え間違えた(正しくは 47 件)",
        "集計を見直した",
        "訂正",
      ],
      [
        "未決の相談(2026-11-09)",
        "「クラスの『使われている』は、今日以降の授業だけでよいか」と相談したが、外部設計書 R5-7 が、すでに定めていた",
        "仕様と突き合わせた",
        "未決から外し、「解決済み」に訂正",
      ],
      [
        "説明(2026-11-10)",
        "テスト用に切った DB のブランチが、本番のコピー(メール・氏名)と、本番と同じパスワードのロールを引き継ぐことを、最初の説明で伝え損ねた",
        "設計者の質問(「さっき作ったのは、いまある DB をもとにブランチを作ったけど?」)",
        "公式ドキュメントで確認し、リスクを説明。接続文字列を他の人に渡さない決まりを、記録した",
      ],
      [
        "記録(2026-11-10)",
        "Notion の更新で、打ち間違い(「なあく」)が入った",
        "更新後の読み直し",
        "訂正",
      ],
      [
        "調査(開発の途中)",
        "DB の時刻が 9 時間ずれていると警告したが、ドライバが、時刻の表示を端末の時間帯で読んだだけで、保存されている値は正しかった(誤警報)",
        "生の値を、直接読んで確かめた",
        "誤警報と訂正",
      ],
      [
        "位置の仕様(2026-11-09)",
        "1 つの教室に複数の受信機 ID を登録した場合の動きを、不正確に説明した(ゲートウェイは、教室 ID の文字列で、「3 回連続」を数えるため、同じ教室の複数台には、同じ教室 ID を書く必要がある)",
        "コードと仕様を読み直した",
        "説明を訂正し、14 章に決定として記録した",
      ],
    ],
    [20, 36, 20, 24],
    { size: 15 },
  ),
  h2("3-7. 人が止めた・同意を求めた例(安全の仕組み)"),
  bullets([
    "**共有データベースへの書き込み**は、内容を先に見せ、許可を得てから行った(管理者の登録 3 件)。自動の判定が、許可のない書き込みを拒否したときも、迂回しなかった。",
    "**結合テストの準備**(表を作り直し、データが消えるコマンド)は、Prisma の安全装置が、AI の実行を止めた。人が同意の文面を示してから、1 回だけ実行した。それ以後は、人が自分のターミナルで実行した。",
    "テスト用 DB は、**名前が `_test` で終わるものしか使えない**仕組みにした。接続先を、誤って本物の DB にしても、止まる。",
    "秘密の値(接続文字列など)は、AI に表示させない。必要なときは、クリップボードから、ファイルへ直接書き込み、画面には出さない形で扱った。",
  ]),
  h2("3-8. 機密・個人情報の扱い"),
  bullets([
    "秘密の値(接続文字列、ログインの鍵、ゲートウェイの鍵、クライアントシークレット)は、Git・Notion・本書類に書かない。環境変数だけで扱う。",
    "AI との会話に、実在のメールアドレスが出ることがある(管理者の登録など、必要な場合のみ。本人の了承の範囲)。会話の記録は、利用者の PC に保存される。",
    "デモデータは、すべて架空。ログインした人のメール・氏名は DB に入るため、デモのあとに整理する(13 章)。",
  ]),
  h2("3-9. リスクと対策"),
  ...table(
    ["リスク", "対策"],
    [
      [
        "AI の誤り(間違った実装、件数の間違い、思い込み)",
        "型・テスト・ビルドの自動チェック。設計書の期待値を先に書く。突き合わせ。人の確認。誤りは記録に残す",
      ],
      [
        "AI が、勝手に変更・削除する",
        "変更の前に、内容を伝えて許可を取る決まり(`CLAUDE.md`)。データを消すコマンドには、安全装置と、人の同意",
      ],
      [
        "本物のデータの破壊",
        "テストは、テスト用 DB だけ(接続先の確認)。共有 DB への書き込みは、内容を見せて確認。戻せない操作の前に、バックアップ(Neon のブランチ)",
      ],
      [
        "秘密の値・個人情報の漏えい",
        "秘密の値を AI に見せない。Git・Notion に書かない。公開リポジトリの内容を、確認する",
      ],
      [
        "ライセンス・著作権",
        "ライブラリのライセンスを確認(本書 2-3)。外部のコードを転載しない。AI の生成物(アイコンなど)は、本プロジェクトの成果物として扱う",
      ],
      [
        "AI に頼りすぎて、中身が分からなくなる",
        "設計書(Notion)を、人が読める形で残す。人が決める内容と、AI がする作業を分ける。設計者が、内容を確認し、質問する(会話の記録に残る)",
      ],
    ],
    [30, 70],
  ),
  h2("3-10. 責任"),
  p(
    "成果物の最終的な責任は、人(設計者)にある。AI の出力を、そのまま信じず、テストと見直しで確かめ、結果を、通らなかったものも含めて報告する。学校の AI 利用のルールがある場合は、それに従う。",
  ),
];

module.exports = (outDir) => L.build(meta, body, outDir);
