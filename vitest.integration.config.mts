import { defineConfig } from "vitest/config";

// 結合テスト (tests/integration): the real handlers and server functions on a real PostgreSQL.
// `npm test` does not run these (their files end in .it.ts). Run: npm run test:integration
// The database is TEST_DATABASE_URL only (CI: a throw-away PostgreSQL; on a PC: a Neon
// database named *_test). tests/integration/support/guard.ts refuses anything else.
process.env.TZ = "UTC";
try {
  // Not committed (.env* is ignored). Holds TEST_DATABASE_URL for a PC.
  process.loadEnvFile(".env.integration");
} catch {
  // CI: the value comes from the real environment.
}

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.it.ts"],
    globalSetup: ["tests/integration/support/global-setup.ts"],
    // One database: files run one after another, and each test starts from an empty one.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
