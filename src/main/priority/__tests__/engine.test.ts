import { describe, it, expect, beforeEach } from 'vitest'
import { createMockDb } from '../../__tests__/helpers/mock-db'
import { computeFocus } from '../engine'
import { projects, tasks, triggers } from '../../db/schema'
import { TaskColumn, TriggerStatus } from '../../../shared/types/enums'
import type { AppDatabase } from '../../db'

describe('Priority Engine', () => {
  let db: AppDatabase

  beforeEach(() => {
    db = createMockDb()
  })

  describe('computeFocus', () => {
    it('returns null when no tasks exist', () => {
      const result = computeFocus(db)
      expect(result.task).toBeNull()
      expect(result.project).toBeNull()
      expect(result.trigger).toBeNull()
      expect(result.queueDepth).toEqual({ actionable: 0, waiting: 0 })
    })

    it('returns null when all tasks are archived', () => {
      const project = db
        .insert(projects)
        .values({ name: 'Test Project', priorityRank: 0 })
        .returning()
        .get()
      db.insert(tasks).values({
        title: 'Archived task',
        projectId: project.id,
        column: TaskColumn.Planning,
        archived: true
      })

      const result = computeFocus(db)
      expect(result.task).toBeNull()
      expect(result.queueDepth).toEqual({ actionable: 0, waiting: 0 })
    })

    it('excludes backlog tasks from focus view', () => {
      const project = db
        .insert(projects)
        .values({ name: 'Test Project', priorityRank: 0 })
        .returning()
        .get()
      db.insert(tasks).values({
        title: 'Backlog task',
        projectId: project.id,
        column: TaskColumn.Backlog,
        archived: false
      })

      const result = computeFocus(db)
      expect(result.task).toBeNull()
      expect(result.queueDepth).toEqual({ actionable: 0, waiting: 0 })
    })

    it('returns a single actionable task', () => {
      const project = db
        .insert(projects)
        .values({ name: 'Test Project', priorityRank: 0 })
        .returning()
        .get()
      const task = db
        .insert(tasks)
        .values({
          title: 'Test task',
          projectId: project.id,
          column: TaskColumn.Planning,
          archived: false
        })
        .returning()
        .get()

      const result = computeFocus(db)
      expect(result.task).toBeTruthy()
      expect(result.task?.id).toBe(task.id)
      expect(result.project?.id).toBe(project.id)
      expect(result.trigger).toBeNull()
      expect(result.queueDepth).toEqual({ actionable: 1, waiting: 0 })
    })

    describe('Column precedence', () => {
      it('prioritizes review over in_progress', () => {
        const project = db
          .insert(projects)
          .values({ name: 'Test Project', priorityRank: 0 })
          .returning()
          .get()

        db.insert(tasks)
          .values({
            title: 'In progress task',
            projectId: project.id,
            column: TaskColumn.InProgress,
            archived: false
          })
          .run()

        const reviewTask = db
          .insert(tasks)
          .values({
            title: 'Review task',
            projectId: project.id,
            column: TaskColumn.Review,
            archived: false
          })
          .returning()
          .get()

        const result = computeFocus(db)
        expect(result.task?.id).toBe(reviewTask.id)
      })

      it('prioritizes in_progress over planning', () => {
        const project = db
          .insert(projects)
          .values({ name: 'Test Project', priorityRank: 0 })
          .returning()
          .get()

        db.insert(tasks)
          .values({
            title: 'Planning task',
            projectId: project.id,
            column: TaskColumn.Planning,
            archived: false
          })
          .run()

        const inProgressTask = db
          .insert(tasks)
          .values({
            title: 'In progress task',
            projectId: project.id,
            column: TaskColumn.InProgress,
            archived: false
          })
          .returning()
          .get()

        const result = computeFocus(db)
        expect(result.task?.id).toBe(inProgressTask.id)
      })

      it('prioritizes planning over backlog (though backlog is excluded)', () => {
        const project = db
          .insert(projects)
          .values({ name: 'Test Project', priorityRank: 0 })
          .returning()
          .get()

        db.insert(tasks).values({
          title: 'Backlog task',
          projectId: project.id,
          column: TaskColumn.Backlog,
          archived: false
        })

        const planningTask = db
          .insert(tasks)
          .values({
            title: 'Planning task',
            projectId: project.id,
            column: TaskColumn.Planning,
            archived: false
          })
          .returning()
          .get()

        const result = computeFocus(db)
        expect(result.task?.id).toBe(planningTask.id)
      })
    })

    describe('Trigger recency', () => {
      it('prioritizes task with recently fired trigger over task without trigger', () => {
        const project = db
          .insert(projects)
          .values({ name: 'Test Project', priorityRank: 0 })
          .returning()
          .get()

        db.insert(tasks)
          .values({
            title: 'Task without trigger',
            projectId: project.id,
            column: TaskColumn.InProgress,
            archived: false
          })
          .run()

        const taskWithTrigger = db
          .insert(tasks)
          .values({
            title: 'Task with trigger',
            projectId: project.id,
            column: TaskColumn.InProgress,
            archived: false
          })
          .returning()
          .get()

        db.insert(triggers)
          .values({
            taskId: taskWithTrigger.id,
            nlCondition: 'When CI passes',
            status: TriggerStatus.Fired,
            firedAt: '2026-02-14T10:00:00Z'
          })
          .run()

        const result = computeFocus(db)
        expect(result.task?.id).toBe(taskWithTrigger.id)
        expect(result.trigger).toBeTruthy()
      })

      it('prioritizes task with more recent trigger', () => {
        const project = db
          .insert(projects)
          .values({ name: 'Test Project', priorityRank: 0 })
          .returning()
          .get()

        const olderTriggerTask = db
          .insert(tasks)
          .values({
            title: 'Task with older trigger',
            projectId: project.id,
            column: TaskColumn.InProgress,
            archived: false
          })
          .returning()
          .get()

        const newerTriggerTask = db
          .insert(tasks)
          .values({
            title: 'Task with newer trigger',
            projectId: project.id,
            column: TaskColumn.InProgress,
            archived: false
          })
          .returning()
          .get()

        db.insert(triggers)
          .values({
            taskId: olderTriggerTask.id,
            nlCondition: 'When CI passes',
            status: TriggerStatus.Fired,
            firedAt: '2026-02-14T09:00:00Z'
          })
          .run()

        db.insert(triggers)
          .values({
            taskId: newerTriggerTask.id,
            nlCondition: 'When PR approved',
            status: TriggerStatus.Fired,
            firedAt: '2026-02-14T10:00:00Z'
          })
          .run()

        const result = computeFocus(db)
        expect(result.task?.id).toBe(newerTriggerTask.id)
      })
    })

    describe('Project rank', () => {
      it('prioritizes task from higher-ranked project', () => {
        const lowerPriorityProject = db
          .insert(projects)
          .values({
            name: 'Lower Priority',
            priorityRank: 10
          })
          .returning()
          .get()

        const higherPriorityProject = db
          .insert(projects)
          .values({
            name: 'Higher Priority',
            priorityRank: 5
          })
          .returning()
          .get()

        db.insert(tasks)
          .values({
            title: 'Lower priority task',
            projectId: lowerPriorityProject.id,
            column: TaskColumn.InProgress,
            archived: false
          })
          .run()

        const higherPriorityTask = db
          .insert(tasks)
          .values({
            title: 'Higher priority task',
            projectId: higherPriorityProject.id,
            column: TaskColumn.InProgress,
            archived: false
          })
          .returning()
          .get()

        const result = computeFocus(db)
        expect(result.task?.id).toBe(higherPriorityTask.id)
        expect(result.project?.id).toBe(higherPriorityProject.id)
      })
    })

    describe('Last touched tiebreaker', () => {
      it('prioritizes more recently touched task', () => {
        const project = db
          .insert(projects)
          .values({ name: 'Test Project', priorityRank: 0 })
          .returning()
          .get()

        db.insert(tasks)
          .values({
            title: 'Older task',
            projectId: project.id,
            column: TaskColumn.InProgress,
            archived: false,
            lastTouchedAt: '2026-02-14T08:00:00Z'
          })
          .run()

        const newerTask = db
          .insert(tasks)
          .values({
            title: 'Newer task',
            projectId: project.id,
            column: TaskColumn.InProgress,
            archived: false,
            lastTouchedAt: '2026-02-14T09:00:00Z'
          })
          .returning()
          .get()

        const result = computeFocus(db)
        expect(result.task?.id).toBe(newerTask.id)
      })
    })

    describe('Time in queue (starvation prevention)', () => {
      it('prioritizes older task when all else is equal', () => {
        const project = db
          .insert(projects)
          .values({ name: 'Test Project', priorityRank: 0 })
          .returning()
          .get()

        db.insert(tasks)
          .values({
            title: 'Newer task',
            projectId: project.id,
            column: TaskColumn.InProgress,
            archived: false,
            lastTouchedAt: '2026-02-14T09:00:00Z',
            createdAt: '2026-02-14T09:00:00Z'
          })
          .run()

        const olderTask = db
          .insert(tasks)
          .values({
            title: 'Older task',
            projectId: project.id,
            column: TaskColumn.InProgress,
            archived: false,
            lastTouchedAt: '2026-02-14T09:00:00Z',
            createdAt: '2026-02-14T08:00:00Z'
          })
          .returning()
          .get()

        const result = computeFocus(db)
        expect(result.task?.id).toBe(olderTask.id)
      })
    })

    describe('Waiting task exclusion', () => {
      it('excludes tasks with pending triggers', () => {
        const project = db
          .insert(projects)
          .values({ name: 'Test Project', priorityRank: 0 })
          .returning()
          .get()

        const actionableTask = db
          .insert(tasks)
          .values({
            title: 'Actionable task',
            projectId: project.id,
            column: TaskColumn.InProgress,
            archived: false
          })
          .returning()
          .get()

        const waitingTask = db
          .insert(tasks)
          .values({
            title: 'Waiting task',
            projectId: project.id,
            column: TaskColumn.InProgress,
            archived: false
          })
          .returning()
          .get()

        db.insert(triggers)
          .values({
            taskId: waitingTask.id,
            nlCondition: 'When CI passes',
            status: TriggerStatus.Pending
          })
          .run()

        const result = computeFocus(db)
        expect(result.task?.id).toBe(actionableTask.id)
        expect(result.queueDepth).toEqual({ actionable: 1, waiting: 1 })
      })

      it('excludes tasks with polling triggers', () => {
        const project = db
          .insert(projects)
          .values({ name: 'Test Project', priorityRank: 0 })
          .returning()
          .get()

        const actionableTask = db
          .insert(tasks)
          .values({
            title: 'Actionable task',
            projectId: project.id,
            column: TaskColumn.InProgress,
            archived: false
          })
          .returning()
          .get()

        const waitingTask = db
          .insert(tasks)
          .values({
            title: 'Waiting task',
            projectId: project.id,
            column: TaskColumn.InProgress,
            archived: false
          })
          .returning()
          .get()

        db.insert(triggers)
          .values({
            taskId: waitingTask.id,
            nlCondition: 'When PR approved',
            status: TriggerStatus.Polling
          })
          .run()

        const result = computeFocus(db)
        expect(result.task?.id).toBe(actionableTask.id)
        expect(result.queueDepth).toEqual({ actionable: 1, waiting: 1 })
      })

      it('excludes tasks with awaiting_approval triggers', () => {
        const project = db
          .insert(projects)
          .values({ name: 'Test Project', priorityRank: 0 })
          .returning()
          .get()

        const actionableTask = db
          .insert(tasks)
          .values({
            title: 'Actionable task',
            projectId: project.id,
            column: TaskColumn.InProgress,
            archived: false
          })
          .returning()
          .get()

        const waitingTask = db
          .insert(tasks)
          .values({
            title: 'Waiting for approval task',
            projectId: project.id,
            column: TaskColumn.InProgress,
            archived: false
          })
          .returning()
          .get()

        db.insert(triggers)
          .values({
            taskId: waitingTask.id,
            nlCondition: 'When CI passes',
            status: TriggerStatus.AwaitingApproval
          })
          .run()

        const result = computeFocus(db)
        expect(result.task?.id).toBe(actionableTask.id)
        expect(result.queueDepth).toEqual({ actionable: 1, waiting: 1 })
      })

      it('includes tasks with fired triggers', () => {
        const project = db
          .insert(projects)
          .values({ name: 'Test Project', priorityRank: 0 })
          .returning()
          .get()

        const task = db
          .insert(tasks)
          .values({
            title: 'Task with fired trigger',
            projectId: project.id,
            column: TaskColumn.InProgress,
            archived: false
          })
          .returning()
          .get()

        db.insert(triggers)
          .values({
            taskId: task.id,
            nlCondition: 'When CI passes',
            status: TriggerStatus.Fired,
            firedAt: '2026-02-14T10:00:00Z'
          })
          .run()

        const result = computeFocus(db)
        expect(result.task?.id).toBe(task.id)
        expect(result.queueDepth).toEqual({ actionable: 1, waiting: 0 })
      })

      it('includes tasks with failed triggers', () => {
        const project = db
          .insert(projects)
          .values({ name: 'Test Project', priorityRank: 0 })
          .returning()
          .get()

        const task = db
          .insert(tasks)
          .values({
            title: 'Task with failed trigger',
            projectId: project.id,
            column: TaskColumn.InProgress,
            archived: false
          })
          .returning()
          .get()

        db.insert(triggers)
          .values({
            taskId: task.id,
            nlCondition: 'When CI passes',
            status: TriggerStatus.Failed
          })
          .run()

        const result = computeFocus(db)
        expect(result.task?.id).toBe(task.id)
        expect(result.queueDepth).toEqual({ actionable: 1, waiting: 0 })
      })

      it('includes tasks with cancelled triggers', () => {
        const project = db
          .insert(projects)
          .values({ name: 'Test Project', priorityRank: 0 })
          .returning()
          .get()

        const task = db
          .insert(tasks)
          .values({
            title: 'Task with cancelled trigger',
            projectId: project.id,
            column: TaskColumn.InProgress,
            archived: false
          })
          .returning()
          .get()

        db.insert(triggers)
          .values({
            taskId: task.id,
            nlCondition: 'When CI passes',
            status: TriggerStatus.Cancelled
          })
          .run()

        const result = computeFocus(db)
        expect(result.task?.id).toBe(task.id)
        expect(result.queueDepth).toEqual({ actionable: 1, waiting: 0 })
      })
    })

    describe('Queue depth calculation', () => {
      it('correctly counts actionable and waiting tasks', () => {
        const project = db
          .insert(projects)
          .values({ name: 'Test Project', priorityRank: 0 })
          .returning()
          .get()

        // 3 actionable tasks
        db.insert(tasks)
          .values({
            title: 'Actionable 1',
            projectId: project.id,
            column: TaskColumn.Planning,
            archived: false
          })
          .run()
        db.insert(tasks)
          .values({
            title: 'Actionable 2',
            projectId: project.id,
            column: TaskColumn.InProgress,
            archived: false
          })
          .run()
        db.insert(tasks)
          .values({
            title: 'Actionable 3',
            projectId: project.id,
            column: TaskColumn.Review,
            archived: false
          })
          .run()

        // 2 waiting tasks
        const waiting1 = db
          .insert(tasks)
          .values({
            title: 'Waiting 1',
            projectId: project.id,
            column: TaskColumn.Planning,
            archived: false
          })
          .returning()
          .get()
        const waiting2 = db
          .insert(tasks)
          .values({
            title: 'Waiting 2',
            projectId: project.id,
            column: TaskColumn.InProgress,
            archived: false
          })
          .returning()
          .get()

        db.insert(triggers)
          .values({
            taskId: waiting1.id,
            nlCondition: 'When CI passes',
            status: TriggerStatus.Pending
          })
          .run()
        db.insert(triggers)
          .values({
            taskId: waiting2.id,
            nlCondition: 'When PR approved',
            status: TriggerStatus.Polling
          })
          .run()

        // 1 backlog task (not counted in either)
        db.insert(tasks)
          .values({
            title: 'Backlog',
            projectId: project.id,
            column: TaskColumn.Backlog,
            archived: false
          })
          .run()

        const result = computeFocus(db)
        expect(result.queueDepth).toEqual({ actionable: 3, waiting: 2 })
      })
    })

    describe('Mixed scenario', () => {
      it('correctly prioritizes across multiple projects, columns, and trigger states', () => {
        // Create two projects with different ranks
        const projectA = db
          .insert(projects)
          .values({
            name: 'Project A',
            priorityRank: 10
          })
          .returning()
          .get()
        const projectB = db
          .insert(projects)
          .values({
            name: 'Project B',
            priorityRank: 5
          })
          .returning()
          .get()

        // Project A, Review column (highest column), no trigger
        const taskA1 = db
          .insert(tasks)
          .values({
            title: 'Project A Review',
            projectId: projectA.id,
            column: TaskColumn.Review,
            archived: false,
            lastTouchedAt: '2026-02-14T08:00:00Z',
            createdAt: '2026-02-14T08:00:00Z'
          })
          .returning()
          .get()

        // Project B, In Progress, with recent fired trigger
        const taskB1 = db
          .insert(tasks)
          .values({
            title: 'Project B In Progress with Trigger',
            projectId: projectB.id,
            column: TaskColumn.InProgress,
            archived: false,
            lastTouchedAt: '2026-02-14T09:00:00Z',
            createdAt: '2026-02-14T09:00:00Z'
          })
          .returning()
          .get()

        db.insert(triggers)
          .values({
            taskId: taskB1.id,
            nlCondition: 'When agent completes',
            status: TriggerStatus.Fired,
            firedAt: '2026-02-14T10:00:00Z'
          })
          .run()

        // Project B, Planning, no trigger
        db.insert(tasks)
          .values({
            title: 'Project B Planning',
            projectId: projectB.id,
            column: TaskColumn.Planning,
            archived: false,
            lastTouchedAt: '2026-02-14T09:30:00Z',
            createdAt: '2026-02-14T09:30:00Z'
          })
          .run()

        // Project A, In Progress, waiting on trigger
        const taskA2 = db
          .insert(tasks)
          .values({
            title: 'Project A Waiting',
            projectId: projectA.id,
            column: TaskColumn.InProgress,
            archived: false,
            lastTouchedAt: '2026-02-14T10:00:00Z',
            createdAt: '2026-02-14T10:00:00Z'
          })
          .returning()
          .get()

        db.insert(triggers)
          .values({
            taskId: taskA2.id,
            nlCondition: 'When build passes',
            status: TriggerStatus.Pending
          })
          .run()

        const result = computeFocus(db)

        // Should pick Project A Review task (Review column beats everything)
        expect(result.task?.id).toBe(taskA1.id)
        expect(result.project?.id).toBe(projectA.id)

        // Queue depth: 3 actionable (A1, B1, B2), 1 waiting (A2)
        expect(result.queueDepth).toEqual({ actionable: 3, waiting: 1 })
      })
    })
  })
})
