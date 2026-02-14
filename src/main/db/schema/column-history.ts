import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { tasks } from './tasks'

export const columnHistory = sqliteTable('column_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  fromColumn: text('from_column', {
    enum: ['backlog', 'planning', 'in_progress', 'review']
  }),
  toColumn: text('to_column', {
    enum: ['backlog', 'planning', 'in_progress', 'review']
  }).notNull(),
  contextSnapshot: text('context_snapshot'),
  movedAt: text('moved_at')
    .notNull()
    .default(sql`(datetime('now'))`)
})
