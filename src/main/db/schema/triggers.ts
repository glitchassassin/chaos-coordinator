import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { tasks } from './tasks'

export const triggers = sqliteTable('triggers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  nlCondition: text('nl_condition').notNull(),
  interpretedCheck: text('interpreted_check'),
  status: text('status', {
    enum: ['pending', 'polling', 'fired', 'failed', 'cancelled']
  })
    .notNull()
    .default('pending'),
  pollIntervalMs: integer('poll_interval_ms').notNull().default(300000),
  failureCount: integer('failure_count').notNull().default(0),
  firedContext: text('fired_context'),
  firedAt: text('fired_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`)
})
