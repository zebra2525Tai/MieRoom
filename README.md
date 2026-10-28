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

| コマンド            | 内容                                             |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | 開発サーバー                                     |
| `npm run build`     | 本番のビルド                                     |
| `npm run lint`      | ESLint                                           |
| `npm run format`    | Prettier で整える(`format:check` は確かめるだけ) |
| `npm run typecheck` | 型チェック(`next typegen` のあと `tsc --noEmit`) |
| `npm test`          | Vitest(時刻は UTC で動く)                        |

プルリクエストのたびに、GitHub Actions が `format:check`・`lint`・`typecheck`・`test`・`build` を走らせる。

## 注意

- 部品は `npm ci` で入れる。Prisma を入れるときは必ず `prisma@7` と `@prisma/client@7`(`@latest` は 8 になる)。
- `.env.local` や秘密の値は commit しない。
- `/_dev` のフォルダ名は `app/%5Fdev`(`_dev` だと Next.js のプライベートフォルダになり、URL にならない)。
