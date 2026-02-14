import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { sql } from 'drizzle-orm'
import * as schema from '../../db/schema'
import type { AppDatabase } from '../../db'

/**
 * Creates an in-memory SQLite database with all schema tables.
 * Returns a Drizzle instance compatible with AppDatabase.
 *
 * Usage in tests:
 *   vi.mock('../../db', () => ({ getDb: () => mockDb }))
 */
export function createMockDb(): AppDatabase {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })

  db.run(sql`
    CREATE TABLE projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color_primary TEXT NOT NULL DEFAULT '#6366f1',
      color_accent TEXT NOT NULL DEFAULT '#818cf8',
      background_image TEXT,
      priority_rank INTEGER NOT NULL DEFAULT 0,
      repo_associations TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  db.run(sql`
    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      context_block TEXT,
      "column" TEXT NOT NULL DEFAULT 'planning',
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      archived INTEGER NOT NULL DEFAULT 0,
      last_touched_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  db.run(sql`
    CREATE TABLE triggers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      nl_condition TEXT NOT NULL,
      check_script TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      poll_interval_ms INTEGER NOT NULL DEFAULT 300000,
      failure_count INTEGER NOT NULL DEFAULT 0,
      fired_context TEXT,
      fired_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  db.run(sql`
    CREATE TABLE links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      label TEXT,
      source_type TEXT NOT NULL DEFAULT 'other',
      is_primary INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  db.run(sql`
    CREATE TABLE column_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      from_column TEXT,
      to_column TEXT NOT NULL,
      context_snapshot TEXT,
      moved_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  return db
}
