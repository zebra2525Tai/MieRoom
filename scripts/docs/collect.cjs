"use strict";
// 提出書類に入れる数字・一覧を、リポジトリの今の状態から集めて `.docs-cache/` に書く。
//   node scripts/docs/collect.cjs [--skip-tests]
// --skip-tests: 単体テストを走らせず、前回の結果(.docs-cache/unit-raw.json)を使う。
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const CACHE = path.join(ROOT, ".docs-cache");
const skipTests = process.argv.includes("--skip-tests");

fs.mkdirSync(CACHE, { recursive: true });
const write = (name, value) =>
  fs.writeFileSync(path.join(CACHE, name), JSON.stringify(value, null, 1));

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 1 << 28,
    ...opts,
  });
  if (r.error) throw r.error;
  return r;
}
const git = (...args) => {
  const r = run("git", args);
  if (r.status !== 0)
    throw new Error(`git ${args.join(" ")} が失敗しました: ${r.stderr}`);
  return r.stdout;
};

// --- 1. 単体テスト(Vitest の JSON 結果) ---
const rawFile = path.join(CACHE, "unit-raw.json");
if (!skipTests) {
  console.log("単体テストを実行しています…");
  const r = run(process.execPath, [
    path.join(ROOT, "node_modules", "vitest", "vitest.mjs"),
    "run",
    "--reporter=json",
    `--outputFile=${rawFile}`,
  ]);
  if (!fs.existsSync(rawFile))
    throw new Error(`単体テストの結果が出ませんでした:\n${r.stderr}`);
}
if (!fs.existsSync(rawFile))
  throw new Error(
    "単体テストの結果がありません。--skip-tests を外してください",
  );
const raw = JSON.parse(fs.readFileSync(rawFile, "utf8"));
const unit = {
  total: raw.numTotalTests,
  pass: raw.numPassedTests,
  fail: raw.numFailedTests,
  files: raw.testResults.map((f) => ({
    file: path.relative(ROOT, f.name).split(path.sep).join("/"),
    n: f.assertionResults.length,
    pass: f.assertionResults.filter((a) => a.status === "passed").length,
  })),
};
write("unit.json", unit);
console.log(
  `単体: ${unit.pass} / ${unit.total}(${unit.files.length} ファイル)`,
);

// --- 2. メッセージ(lib/messages.ts から) ---
{
  const r = run(process.execPath, [
    path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs"),
    path.join(__dirname, "messages.ts"),
    path.join(CACHE, "messages.json"),
  ]);
  if (r.status !== 0)
    throw new Error(`メッセージの取り出しに失敗しました:\n${r.stderr}`);
  console.log(r.stdout.trim());
}

// --- 3. Git の履歴 ---
const log = git("log", "--format=%an|%ad|%s", "--date=short")
  .trim()
  .split("\n")
  .map((line) => {
    const [a, d, ...s] = line.split("|");
    return { a, d, s: s.join("|") };
  });
const byAuthor = {};
const byDay = {};
for (const c of log) {
  byAuthor[c.a] = (byAuthor[c.a] || 0) + 1;
  byDay[c.d] = (byDay[c.d] || 0) + 1;
}
write("git.json", {
  total: log.length,
  byAuthor,
  byDay,
  first: log[log.length - 1].d,
  last: log[0].d,
  head: git("rev-parse", "--short", "HEAD").trim(),
});
console.log(`git: ${log.length} コミット`);

// AI の共同作者(Co-Authored-By)の記載数
const bodies = git("log", "--format=%B%x1e").split("\x1e");
const trailers = { sonnet: 0, opus: 0, all: 0 };
for (const b of bodies) {
  if (/Co-Authored-By: Claude/i.test(b)) trailers.all++;
  if (/Co-Authored-By: Claude Sonnet 5\.5/i.test(b)) trailers.sonnet++;
  if (/Co-Authored-By: Claude Opus 5\.5/i.test(b)) trailers.opus++;
}

// --- 4. 結合テストの名前(静的に読む。実行はしない) ---
const integ = [];
const itDir = path.join(ROOT, "tests", "integration");
for (const file of fs
  .readdirSync(itDir)
  .filter((f) => f.endsWith(".it.ts"))
  .sort()) {
  const text = fs.readFileSync(path.join(itDir, file), "utf8");
  const re =
    /(^|\n)(\s*)(describe(?:\.each\([^)]*\))?|it)\(\s*"((?:[^"\\]|\\.)*)"/g;
  let group = "";
  let m;
  while ((m = re.exec(text))) {
    if (m[3].startsWith("describe")) group = m[4];
    else integ.push({ file, group, title: m[4] });
  }
}
write("integration.json", integ);
console.log(`結合テストの名前: ${integ.length}`);

// --- 5. ライセンス(インストールされている全パッケージ) ---
{
  const nm = path.join(ROOT, "node_modules");
  const pkgDirs = [];
  for (const name of fs.readdirSync(nm)) {
    if (name.startsWith(".")) continue;
    if (name.startsWith("@")) {
      for (const sub of fs.readdirSync(path.join(nm, name)))
        pkgDirs.push(path.join(nm, name, sub));
    } else pkgDirs.push(path.join(nm, name));
  }
  const byLicense = new Map();
  let total = 0;
  for (const dir of pkgDirs) {
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    } catch {
      continue;
    }
    total++;
    let license = pkg.license;
    if (license && typeof license === "object") license = license.type;
    if (!license && Array.isArray(pkg.licenses))
      license = pkg.licenses.map((l) => l.type).join(" OR ");
    license = license || "(記載なし)";
    const entry = byLicense.get(license) || { license, count: 0, examples: [] };
    entry.count++;
    if (entry.examples.length < 3) entry.examples.push(pkg.name);
    byLicense.set(license, entry);
  }
  const out = [...byLicense.values()].sort(
    (a, b) => b.count - a.count || a.license.localeCompare(b.license),
  );
  write("licenses.json", { total, out });
  console.log(`ライセンス: ${total} パッケージ、${out.length} 種類`);
}

// --- 6. 規模(コミット済みのファイルだけを数える) ---
{
  const files = git("ls-files").trim().split("\n");
  const lines = (list) =>
    list.reduce((sum, f) => {
      const t = fs.readFileSync(path.join(ROOT, f), "utf8");
      return (
        sum + (t === "" ? 0 : t.split("\n").length - (t.endsWith("\n") ? 1 : 0))
      );
    }, 0);
  const isTs = (f) => /\.(ts|tsx)$/.test(f);
  const src = files.filter(
    (f) => isTs(f) && (/^(app|lib|components)\//.test(f) || f === "proxy.ts"),
  );
  const tests = files.filter((f) => /^tests\/.*\.(ts|tsx)$/.test(f));
  const schema = fs.readFileSync(
    path.join(ROOT, "prisma", "schema.prisma"),
    "utf8",
  );
  write("facts-auto.json", {
    today: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }),
    files: files.length,
    srcLines: lines(src),
    testLines: lines(tests),
    testFiles: tests.length,
    tables: (schema.match(/^model\s+\w+/gm) || []).length,
    trailers,
  });
  console.log(
    `規模: ソース ${lines(src)} 行、テスト ${tests.length} ファイル ${lines(tests)} 行、表 ${(schema.match(/^model\s+\w+/gm) || []).length}`,
  );
}
