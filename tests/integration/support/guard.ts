import { readFileSync } from "node:fs";

// The integration tests empty every table before each test. This is the one place that decides
// which database they may touch, and it fails closed: no value, no test. It never prints a URL.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

type Target = { host: string; database: string };

function parse(value: string): Target | null {
  try {
    const url = new URL(value);
    return {
      host: url.hostname.toLowerCase(),
      database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    };
  } catch {
    return null;
  }
}

/** DATABASE_URL and DATABASE_URL_UNPOOLED, from the environment and from .env.local. */
function sharedDatabases(): Target[] {
  const values: string[] = [];
  for (const key of ["DATABASE_URL", "DATABASE_URL_UNPOOLED"]) {
    const value = process.env[key];
    if (value) values.push(value);
  }
  try {
    const text = readFileSync(".env.local", "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = /^\s*DATABASE_URL(?:_UNPOOLED)?\s*=\s*(.*)$/.exec(line);
      if (match) values.push(match[1].trim().replace(/^["']|["']$/g, ""));
    }
  } catch {
    // No .env.local (CI): nothing to compare with.
  }
  return values.flatMap((value) => {
    const target = parse(value);
    return target ? [target] : [];
  });
}

/**
 * The connection string of the test database, or an Error that says why not.
 * Allowed: a local PostgreSQL, or a database whose name ends with "_test".
 * Never allowed: the database the app uses (DATABASE_URL, DATABASE_URL_UNPOOLED).
 */
export function testDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Put it in .env.integration (a database named *_test) or, in CI, in the environment.",
    );
  }
  const target = parse(value);
  if (target === null) {
    throw new Error("TEST_DATABASE_URL is not a connection string.");
  }
  const isLocal = LOCAL_HOSTS.has(target.host);
  if (!isLocal && !target.database.endsWith("_test")) {
    throw new Error(
      "Refusing to run: the test database must be local, or its name must end with _test.",
    );
  }
  for (const shared of sharedDatabases()) {
    if (shared.host === target.host && shared.database === target.database) {
      throw new Error(
        "Refusing to run: TEST_DATABASE_URL points at the database the app uses.",
      );
    }
  }
  return value;
}
