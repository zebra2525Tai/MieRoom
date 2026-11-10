import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { testDatabaseUrl } from "./guard";

// The test database. The app talks to Neon through its own driver; a plain PostgreSQL (CI, a PC)
// needs the standard one. Only the tests use this: the app code is the same as in production.

let client: PrismaClient | undefined;

export function testDb(): PrismaClient {
  client ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: testDatabaseUrl() }),
  });
  return client;
}

/** Empties every table (found by name, so a new table needs no change here). */
export async function resetDatabase(): Promise<void> {
  testDatabaseUrl(); // the guard again, right before anything is deleted
  const db = testDb();
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  if (tables.length === 0) return;
  const list = tables
    .map((table) => `"${table.tablename.replaceAll('"', '""')}"`)
    .join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export async function closeDatabase(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
}
