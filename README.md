# MieRoom

卒業制作のWebアプリ。Next.js 16(App Router)/ React 19 / TypeScript / Tailwind CSS 4。

決まりごとの元は Notion の「開発環境まとめ(10/27・メンバー確認用)」。

## 必要なもの

- Node.js 24系(`node -v` が `v24` で始まること。版は `.nvmrc`)
- Git、VS Code(リポジトリを開くと、おすすめの拡張機能が出る)

## 始め方

```bash
git clone <自分のフォークのURL>
cd MieRoom
git switch -c dev/名前
npm ci
cp .env.example .env.local   # 値は代表者から直接受け取る
npm run dev
```

- http://localhost:3000 が開く。`/_dev` は `.env.local` に `ENABLE_DEV_PAGES=true` があるときだけ開く。
- **学校の共有フォルダ(`\\file-svr\...`)の中では動かない**(npm が UNC パスで止まる)。`C:\Users\自分\dev` などのローカルに clone する。作業はこまめに push する。

## コマンド

| コマンド                   | 内容                                                               |
| -------------------------- | ------------------------------------------------------------------ |
| `npm run dev`              | 開発サーバー                                                       |
| `npm run build`            | 本番のビルド                                                       |
| `npm run lint`             | ESLint                                                             |
| `npm run format`           | Prettier で整える(`format:check` は確かめるだけ)                   |
| `npm run typecheck`        | 型チェック(`next typegen` のあと `tsc --noEmit`)                   |
| `npm test`                 | Vitest(時刻は UTC で動く)                                          |
| `npm run test:integration` | 結合テスト(本物の PostgreSQL。下の「結合テスト」)                  |
| `npm run docs:build`       | 提出用の Word 書類 8 点を作る(下の「提出書類」)                    |
| `npm run db:push`          | 表を開発用DBに作る(バック担当だけ。`DATABASE_URL_UNPOOLED` が要る) |
| `npm run db:seed`          | 最初の許可リストなどを開発用DBに入れる(下の「ログインの準備」)     |

プルリクエストのたびに、GitHub Actions が `format:check`・`lint`・`typecheck`・`test`・`build`(`check` ジョブ)と、結合テスト(`integration` ジョブ)を走らせる。

## 結合テスト

入り口から DB までを、本物の PostgreSQL で確かめる(ファイルは `tests/integration/*.it.ts`。`npm test` には含まれない)。CI では、使い捨ての PostgreSQL で自動で動く。

1. テスト用の DB を用意する。名前が `_test` で終わるデータベース(例: Neon の `mieroom_test`)か、手元の PostgreSQL。**テストは、毎回、全テーブルを空にする**ので、アプリの DB(`DATABASE_URL`)は、絶対に使わない。
2. リポジトリ直下に `.env.integration` を作り、`TEST_DATABASE_URL=（直接の接続文字列）` を 1 行入れる(Git には入らない)。
3. 自分のターミナルで `npm run test:integration` を実行する(Windows の PowerShell で「スクリプトの実行が無効」と出たら、`npm.cmd run test:integration`)。約 1 分。
4. 接続先が未設定、名前が `_test` で終わらない、アプリの DB と同じ場所のときは、何も消さずに止まる(正しい動き)。
5. Prisma が「AI から実行された」と止めたら、自分のターミナルで実行する。

接続文字列は、チャットや Git に貼らない。

## 提出書類

提出用の Word 書類(MR-00〜MR-07)は、このリポジトリの今の状態から作り直せる(`scripts/docs/`)。単体テストの件数、Git の履歴、メッセージ一覧、ライセンスの内訳、規模(行数・表の数)は、実行のたびに自動で集める。

```
npm run docs:build                      # submission-docs/ に作る(Git には入らない)
npm run docs:build -- --out <フォルダ>  # 出力先を指定する
npm run docs:build -- --skip-tests      # 単体テストを走らせず、前回の結果を使う
```

- 文章は `scripts/docs/doc00.cjs`〜`doc07.cjs`。文中の `{{I}}` などは、集めた数字に置き換わる(知らない名前だとエラーで止まる)。
- 自動で数えられない値(結合テストの件数、設計したケースの件数、チェックシートの件数)は `scripts/docs/facts.json` を直す。
- 単体テストに失敗があると、書類が「すべて合格」と書くため、作らずに止まる。
- 表紙の作成者・所属、操作マニュアルの画面写真、07 の所感は、Word で人が書く。

## ログインの準備(開発用)

1. Vercel の環境変数に、`.env.example` の値を入れる(Microsoft 関係、`BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`、`ALLOWED_EMAIL_DOMAINS`、`APP_ENV=development` など)。接続文字列や秘密の値は、チャットに貼らず、直接入れる。
2. 表を作る(バック担当だけ): `.env.local` に `DATABASE_URL_UNPOOLED` を入れて `npm run db:push`。
3. 許可リストを入れる: `.env.local` に `SEED_ALLOWED_EMAILS`(カンマ区切り)などを入れて `npm run db:seed`。メールは Git に入れない。
4. 開発環境(`APP_ENV=development`)では、許可リストにある人と `INITIAL_ADMIN_EMAIL` だけがログインできる。
5. localhost ではログインしない。ログインは、自分の Vercel の URL で確かめる(戻り先の URL は `/api/auth/callback/microsoft`)。

## 注意

- 部品は `npm ci` で入れる。Prisma を入れるときは必ず `prisma@7` と `@prisma/client@7`(`@latest` は 8 になる)。
- `.env.local` や秘密の値は commit しない。
- `/_dev` のフォルダ名は `app/%5Fdev`(`_dev` だと Next.js のプライベートフォルダになり、URL にならない)。
