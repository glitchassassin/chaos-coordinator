import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { sql } from 'drizzle-orm'
import { describe, it, expect, beforeEach } from 'vitest'
import * as schema from '../schema'

describe('Database schema', () => {
  let db: ReturnType<typeof drizzle>

  beforeEach(() => {
    const sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    db = drizzle(sqlite, { schema })

    // Create tables manually for in-memory testing
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
        interpreted_check TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        poll_interval_ms INTEGER NOT NULL DEFAULT 300000,
        failure_count INTEGER NOT NULL DEFAULT 0,
        fired_context TEXT,
        fired_at TEXT,
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
  })

  it('creates a project and retrieves it', () => {
    const inserted = db
      .insert(schema.projects)
      .values({ name: 'Test Project' })
      .returning()
      .get()

    expect(inserted.name).toBe('Test Project')
    expect(inserted.colorPrimary).toBe('#6366f1')
    expect(inserted.id).toBe(1)
  })

  it('creates a task linked to a project', () => {
    const project = db
      .insert(schema.projects)
      .values({ name: 'Test Project' })
      .returning()
      .get()

    const task = db
      .insert(schema.tasks)
      .values({
        title: 'Test Task',
        projectId: project.id,
        column: 'planning'
      })
      .returning()
      .get()

    expect(task.title).toBe('Test Task')
    expect(task.projectId).toBe(project.id)
    expect(task.column).toBe('planning')
    expect(task.archived).toBe(false)
  })

  it('creates a trigger for a task', () => {
    const project = db
      .insert(schema.projects)
      .values({ name: 'Test Project' })
      .returning()
      .get()

    const task = db
      .insert(schema.tasks)
      .values({ title: 'Test Task', projectId: project.id })
      .returning()
      .get()

    const trigger = db
      .insert(schema.triggers)
      .values({
        taskId: task.id,
        nlCondition: 'PR #42 gets approved'
      })
      .returning()
      .get()

    expect(trigger.nlCondition).toBe('PR #42 gets approved')
    expect(trigger.status).toBe('pending')
    expect(trigger.pollIntervalMs).toBe(300000)
  })

  it('creates links for a task', () => {
    const project = db
      .insert(schema.projects)
      .values({ name: 'Test Project' })
      .returning()
      .get()

    const task = db
      .insert(schema.tasks)
      .values({ title: 'Test Task', projectId: project.id })
      .returning()
      .get()

    const link = db
      .insert(schema.links)
      .values({
        taskId: task.id,
        url: 'https://github.com/org/repo/issues/42',
        label: 'Issue #42',
        sourceType: 'github_issue',
        isPrimary: true
      })
      .returning()
      .get()

    expect(link.url).toBe('https://github.com/org/repo/issues/42')
    expect(link.sourceType).toBe('github_issue')
    expect(link.isPrimary).toBe(true)
  })

  it('records column history', () => {
    const project = db
      .insert(schema.projects)
      .values({ name: 'Test Project' })
      .returning()
      .get()

    const task = db
      .insert(schema.tasks)
      .values({ title: 'Test Task', projectId: project.id })
      .returning()
      .get()

    const history = db
      .insert(schema.columnHistory)
      .values({
        taskId: task.id,
        fromColumn: 'planning',
        toColumn: 'in_progress',
        contextSnapshot: 'Started working on the feature'
      })
      .returning()
      .get()

    expect(history.fromColumn).toBe('planning')
    expect(history.toColumn).toBe('in_progress')
    expect(history.contextSnapshot).toBe('Started working on the feature')
  })
})
