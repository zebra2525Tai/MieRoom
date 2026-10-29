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

| コマンド            | 内容                                                               |
| ------------------- | ------------------------------------------------------------------ |
| `npm run dev`       | 開発サーバー                                                       |
| `npm run build`     | 本番のビルド                                                       |
| `npm run lint`      | ESLint                                                             |
| `npm run format`    | Prettier で整える(`format:check` は確かめるだけ)                   |
| `npm run typecheck` | 型チェック(`next typegen` のあと `tsc --noEmit`)                   |
| `npm test`          | Vitest(時刻は UTC で動く)                                          |
| `npm run db:push`   | 表を開発用DBに作る(バック担当だけ。`DATABASE_URL_UNPOOLED` が要る) |
| `npm run db:seed`   | 最初の許可リストなどを開発用DBに入れる(下の「ログインの準備」)     |

プルリクエストのたびに、GitHub Actions が `format:check`・`lint`・`typecheck`・`test`・`build` を走らせる。

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
