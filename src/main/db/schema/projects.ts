import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  colorPrimary: text('color_primary').notNull().default('#6366f1'),
  colorAccent: text('color_accent').notNull().default('#818cf8'),
  backgroundImage: text('background_image'),
  priorityRank: integer('priority_rank').notNull().default(0),
  repoAssociations: text('repo_associations', { mode: 'json' })
    .notNull()
    .default(sql`'[]'`)
    .$type<string[]>(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`)
})
