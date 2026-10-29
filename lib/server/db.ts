import "server-only";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";
import { getEnv } from "./env";

// One client per server process (also across hot reloads in development).
const globalForDb = globalThis as unknown as { prisma?: PrismaClient };

export function getDb(): PrismaClient {
  if (!globalForDb.prisma) {
    const adapter = new PrismaNeon({ connectionString: getEnv().DATABASE_URL });
    globalForDb.prisma = new PrismaClient({ adapter });
  }
  return globalForDb.prisma;
}
