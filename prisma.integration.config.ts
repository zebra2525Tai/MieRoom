import { defineConfig } from "prisma/config";

// The Prisma CLI for the integration tests (結合テスト): it reads only TEST_DATABASE_URL.
// It never loads .env.local, so it can not reach the shared database by mistake.
// Used by tests/integration/support/global-setup.ts after the safety checks of guard.ts.
const url = process.env.TEST_DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  ...(url ? { datasource: { url } } : {}),
});
