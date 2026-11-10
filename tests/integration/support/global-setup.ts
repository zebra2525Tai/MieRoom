import { spawnSync } from "node:child_process";
import { testDatabaseUrl } from "./guard";

// Once before all the integration tests: check the target, then make the tables from
// prisma/schema.prisma (db push). The test database is throw-away, so data loss is accepted.

/** An Error that prints only its message (the stack of a setup file would hide the reason). */
function stop(message: string): Error {
  const error = new Error(message);
  error.stack = message;
  return error;
}

export default function setup() {
  let url: string;
  try {
    url = testDatabaseUrl();
  } catch (error) {
    throw stop(error instanceof Error ? error.message : "Unsafe database.");
  }
  const run = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "prisma",
      "db",
      "push",
      "--config",
      "prisma.integration.config.ts",
      "--accept-data-loss",
    ],
    {
      env: { ...process.env, TEST_DATABASE_URL: url },
      encoding: "utf8",
      shell: process.platform === "win32",
    },
  );
  if (run.status !== 0) {
    const output = `${run.stdout}\n${run.stderr}`.replaceAll(url, "<url>");
    throw stop(`prisma db push failed:\n${output.slice(-2000)}`);
  }
}
