"use strict";
// 提出書類に入れる数字・一覧を読み込む。`collect.cjs` が `.docs-cache/` に集めた値と、
// 手で管理する `facts.json` を合わせて、文書の中の {{名前}} に入れる値を作る。
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const CACHE = path.join(ROOT, ".docs-cache");

function load(name) {
  const file = path.join(CACHE, name);
  if (!fs.existsSync(file)) {
    throw new Error(
      `${name} がありません。先に \`npm run docs:build\` で集め直してください(${CACHE})`,
    );
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const git = load("git.json");
const unit = load("unit.json");
const messages = load("messages.json");
const integ = load("integration.json");
const lic = load("licenses.json");
const auto = load("facts-auto.json");
const manual = JSON.parse(
  fs.readFileSync(path.join(__dirname, "facts.json"), "utf8"),
);

const fmt = (n) => n.toLocaleString("en-US");
const round100 = (n) => fmt(Math.round(n / 100) * 100);
const round10 = (n) => fmt(Math.round(n / 10) * 10);

/** 文書の中の {{名前}} に入れる値。 */
const vars = {
  DATE: auto.today,
  ASOF: auto.today,
  U: unit.pass,
  I: manual.integrationTests,
  MSG: messages.length,
  SRC: round100(auto.srcLines),
  TESTLINES: round100(auto.testLines),
  TESTFILES: auto.testFiles,
  TABLES: auto.tables,
  FILES: round10(auto.files),
  DESIGN: manual.designedCases,
  CHECKSHEET: manual.checksheet,
  TR_SONNET: auto.trailers.sonnet,
  TR_OPUS: auto.trailers.opus,
  TR_ALL: auto.trailers.all,
};

module.exports = { ROOT, git, unit, messages, integ, lic, vars };
