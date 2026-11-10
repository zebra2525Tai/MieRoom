"use strict";
// 提出用の Word 書類(MR-00〜MR-07)を、リポジトリの今の状態から作る。
//   npm run docs:build [-- --out <フォルダ>] [--skip-collect] [--skip-tests]
// 既定の出力先は `submission-docs/`(GitHub には上げない)。
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const outIndex = args.indexOf("--out");
const outDir = path.resolve(
  ROOT,
  outIndex >= 0 && args[outIndex + 1] ? args[outIndex + 1] : "submission-docs",
);

async function main() {
  if (!flag("--skip-collect")) {
    const r = spawnSync(
      process.execPath,
      [
        path.join(__dirname, "collect.cjs"),
        ...(flag("--skip-tests") ? ["--skip-tests"] : []),
      ],
      {
        cwd: ROOT,
        stdio: "inherit",
      },
    );
    if (r.status !== 0) throw new Error("数字の収集に失敗しました");
  }

  const data = require("./data.cjs");
  if (data.unit.fail > 0) {
    throw new Error(
      `単体テストに失敗が ${data.unit.fail} 件あります。書類は「すべて合格」と書くため、直してから作り直してください`,
    );
  }
  require("./lib.cjs").setVars(data.vars);

  for (let i = 0; i <= 7; i++) {
    const file = await require(`./doc0${i}.cjs`)(outDir);
    console.log("作成:", file);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
