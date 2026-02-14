import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { tasks } from './tasks'

export const links = sqliteTable('links', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  label: text('label'),
  sourceType: text('source_type', {
    enum: ['github_issue', 'github_pr', 'azure_devops', 'other']
  })
    .notNull()
    .default('other'),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`)
})
