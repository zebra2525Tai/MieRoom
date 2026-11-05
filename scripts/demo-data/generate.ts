// Writes the fictional master data and timetables into demo-data/ (npm run demo-data).

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildFiles } from "./model";
import { validateFiles } from "./validate";

const outputDir = join(process.cwd(), "demo-data");

function main() {
  const files = buildFiles();

  // Never write files that break the rules of 外部設計書 08章 / 07章.
  const problems = validateFiles(files);
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    throw new Error(`${problems.length} problem(s) in the generated data`);
  }

  rmSync(outputDir, { recursive: true, force: true });
  for (const [path, content] of files) {
    const target = join(outputDir, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, "utf8");
  }
  console.log(`wrote ${files.size} files to demo-data/`);
}

main();
