import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { tasks } from './tasks'

export const triggers = sqliteTable('triggers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  nlCondition: text('nl_condition').notNull(),
  checkScript: text('check_script'),
  status: text('status', {
    enum: ['pending', 'awaiting_approval', 'polling', 'fired', 'failed', 'cancelled']
  })
    .notNull()
    .default('pending'),
  pollIntervalMs: integer('poll_interval_ms').notNull().default(300000),
  failureCount: integer('failure_count').notNull().default(0),
  firedContext: text('fired_context'),
  firedAt: text('fired_at'),
  lastError: text('last_error'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`)
})
