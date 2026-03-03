import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { homedir } from "os";
import { mkdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import * as schema from "./schema.js";

export type Db = BetterSQLite3Database<typeof schema>;

// Use process.cwd() so the path survives bundling (import.meta.url would
// point to build/server/index.js after the production build).
const MIGRATIONS_DIR = join(process.cwd(), "db/migrations");

function openDb(url: string): Db {
  const sqlite = new Database(url);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return db;
}

let instance: Db | null = null;

export function getDb(): Db {
  if (!instance) {
    let url = process.env.DATABASE_URL;
    if (!url) {
      const isDev = process.env.NODE_ENV === "development";
      const dir = isDev
        ? join(fileURLToPath(new URL("../data", import.meta.url)))
        : join(homedir(), ".chaos-coordinator");
      mkdirSync(dir, { recursive: true });
      url = join(dir, "data.db");
    }
    instance = openDb(url);
  }
  return instance;
}

/** Creates a fresh in-memory database for tests. */
export function createTestDb(): Db {
  return openDb(":memory:");
}
