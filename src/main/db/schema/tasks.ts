import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { projects } from './projects'

export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  contextBlock: text('context_block'),
  column: text('column', {
    enum: ['backlog', 'planning', 'in_progress', 'review']
  })
    .notNull()
    .default('planning'),
  projectId: integer('project_id').references(() => projects.id, {
    onDelete: 'set null'
  }),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  columnChangedAt: text('column_changed_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  lastTouchedAt: text('last_touched_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`)
})
