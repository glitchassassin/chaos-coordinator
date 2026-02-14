import { describe, it, expect, beforeEach } from 'vitest'
import * as schema from '../schema'
import type { AppDatabase } from '../index'
import { createMockDb } from '../../__tests__/helpers/mock-db'

describe('Database schema', () => {
  let db: AppDatabase

  beforeEach(() => {
    db = createMockDb()
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
