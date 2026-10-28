import { defineConfig } from "prisma/config";

// The Prisma CLI does not read .env.local by itself (Next.js does that only for the app).
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local (CI, Vercel): values come from the real environment.
}

// Commands that talk to the database (db push, migrate) need the direct, unpooled URL.
// `prisma generate` does not, so a missing value must not break installs and builds.
const url = process.env.DATABASE_URL_UNPOOLED;

export default defineConfig({
  schema: "prisma/schema.prisma",
  ...(url ? { datasource: { url } } : {}),
});
