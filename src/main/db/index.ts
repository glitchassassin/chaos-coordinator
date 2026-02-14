import { app } from 'electron'
import { join } from 'path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

let db: ReturnType<typeof createDb> | null = null

function createDb() {
  const dbPath = join(app.getPath('userData'), 'chaos-coordinator.db')
  const sqlite = new Database(dbPath)

  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  return drizzle(sqlite, { schema })
}

export function getDb() {
  if (!db) {
    db = createDb()
  }
  return db
}

export type AppDatabase = ReturnType<typeof getDb>
