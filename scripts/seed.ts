// Puts the first people into the development database (npm run db:seed).
// The e-mail addresses come from environment variables at run time, so they never
// enter Git. Safe to run again: existing rows are kept.
//
//   SEED_ALLOWED_EMAILS  who may sign in while APP_ENV=development (comma separated)
//   SEED_ADMIN_EMAILS    who becomes 時間割管理者 (the first one is INITIAL_ADMIN_EMAIL anyway)
//   SEED_TEACHER_EMAILS  who becomes 先生 (adds a teacher named after the part before "@")

import { PrismaNeon } from "@prisma/adapter-neon";
import { z } from "zod";
import { PrismaClient } from "../generated/prisma/client";

const email = z.email().transform((value) => value.trim().toLowerCase());

function readList(name: string): string[] {
  const raw = process.env[name] ?? "";
  const items = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
  const parsed = z.array(email).safeParse(items);
  if (!parsed.success) {
    throw new Error(`${name} contains a value that is not an e-mail address`);
  }
  return [...new Set(parsed.data)];
}

async function main() {
  if (process.env.APP_ENV === "production") {
    throw new Error("Refusing to seed: APP_ENV is production");
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const allowed = readList("SEED_ALLOWED_EMAILS");
  const admins = readList("SEED_ADMIN_EMAILS");
  const teachers = readList("SEED_TEACHER_EMAILS");

  const db = new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
  });
  try {
    for (const value of allowed) {
      await db.allowedEmail.upsert({
        where: { email: value },
        update: {},
        create: { email: value },
      });
    }
    for (const value of admins) {
      await db.adminEmail.upsert({
        where: { email: value },
        update: {},
        create: { email: value },
      });
    }
    for (const value of teachers) {
      await db.teacher.upsert({
        where: { email: value },
        update: { active: true },
        create: {
          email: value,
          displayName: value.split("@")[0],
          active: true,
        },
      });
    }
    console.log(
      `Done: ${allowed.length} allowed, ${admins.length} admin, ${teachers.length} teacher e-mail(s).`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Seed failed");
  process.exit(1);
});
