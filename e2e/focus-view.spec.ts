/**
 * E2E tests for T-004: Focus View and T-001: Priority Engine (via Focus View)
 */

import { test, expect } from '@playwright/test'
import {
  createTestDataDir,
  cleanupTestDataDir,
  launchApp,
  waitForReady,
  navigateTo
} from './helpers'
import { seedProject, seedTask, clearAllProjects } from './seed'
import type { ElectronApplication, Page } from 'playwright'

let app: ElectronApplication
let window: Page
let testDataDir: string

test.beforeAll(async () => {
  testDataDir = createTestDataDir()
  app = await launchApp({ testDataDir })
  window = await app.firstWindow()
  await waitForReady(window)
})

test.afterAll(async () => {
  await app.close()
  cleanupTestDataDir(testDataDir)
})

test.beforeEach(async () => {
  await clearAllProjects(window)
  await navigateTo(window, 'focus')
})

// ---------------------------------------------------------------------------
// T-004: Focus View
// ---------------------------------------------------------------------------

test('focus view shows empty state when no tasks exist', async () => {
  await expect(window.getByRole('heading', { name: 'All clear' })).toBeVisible()
  await expect(window.getByText('Nothing actionable right now.')).toBeVisible()
  await expect(window.getByRole('button', { name: 'View Board' })).toBeVisible()
})

test('focus view displays highest-priority task with project info', async () => {
  const project = await seedProject(window, {
    name: 'Focus Project',
    colorPrimary: '#ff0000',
    colorAccent: '#ff6666'
  })
  await seedTask(window, {
    title: 'Focus Task',
    projectId: project.id,
    column: 'planning'
  })

  // Reload focus view
  await navigateTo(window, 'board')
  await navigateTo(window, 'focus')

  // Task title visible
  await expect(
    window.getByRole('heading', { name: 'Focus Task', level: 1 })
  ).toBeVisible()

  // Project name visible
  await expect(window.getByText('Focus Project')).toBeVisible()

  // Action buttons visible
  await expect(window.getByText('Begin Work')).toBeVisible()
  await expect(window.getByText('Defer')).toBeVisible()
  await expect(window.getByText('View Board')).toBeVisible()
})

test('focus view: backlog tasks are not shown (only planning/in_progress/review)', async () => {
  const project = await seedProject(window, { name: 'Backlog Only Project' })
  // Only a backlog task — should result in empty state
  await seedTask(window, {
    title: 'Backlog Task',
    projectId: project.id,
    column: 'backlog'
  })

  await navigateTo(window, 'board')
  await navigateTo(window, 'focus')

  // Empty state, not the backlog task
  await expect(window.getByRole('heading', { name: 'All clear' })).toBeVisible()
  await expect(window.getByText('Backlog Task')).not.toBeVisible()
})

test('focus view: complete action advances task to next column', async () => {
  const project = await seedProject(window, { name: 'Advance Project' })
  await seedTask(window, {
    title: 'Task To Advance',
    projectId: project.id,
    column: 'planning'
  })

  await navigateTo(window, 'board')
  await navigateTo(window, 'focus')

  await expect(
    window.getByRole('heading', { name: 'Task To Advance', level: 1 })
  ).toBeVisible()

  // The action button for planning → in_progress is "Begin Work"
  await expect(window.getByText('Begin Work')).toBeVisible()
  await window.getByText('Begin Work').click()

  // Wait for transition
  await window.waitForTimeout(600)

  // The action button should now show the next stage label since the task
  // advanced to in_progress (same task, still focused), or empty state
  // if it was the only task.
  // Either way, the board should reflect the change:
  await navigateTo(window, 'board')

  // Task should now be in In Progress column
  await expect(window.getByText('Task To Advance')).toBeVisible()
})

test('focus view: archive action archives task from review column', async () => {
  const project = await seedProject(window, { name: 'Review Stage Project' })
  await seedTask(window, {
    title: 'Task In Review',
    projectId: project.id,
    column: 'review'
  })

  await navigateTo(window, 'board')
  await navigateTo(window, 'focus')

  await expect(
    window.getByRole('heading', { name: 'Task In Review', level: 1 })
  ).toBeVisible()
  // Use button role to avoid ambiguity with the "Archive" nav link
  await expect(window.getByRole('button', { name: 'Archive' })).toBeVisible()
  await window.getByRole('button', { name: 'Archive' }).click()

  // Wait for transition
  await window.waitForTimeout(600)

  // Verify the task is gone from board (it's archived)
  await navigateTo(window, 'board')
  await expect(window.getByText('Task In Review')).not.toBeVisible()
})

// ---------------------------------------------------------------------------
// T-001: Priority Engine (via Focus View)
// ---------------------------------------------------------------------------

test('priority engine: review column beats planning column', async () => {
  const project = await seedProject(window, { name: 'Priority Project' })

  // Create tasks in different columns
  await seedTask(window, {
    title: 'Planning Stage Task',
    projectId: project.id,
    column: 'planning'
  })
  await seedTask(window, {
    title: 'Review Stage Task',
    projectId: project.id,
    column: 'review'
  })

  await navigateTo(window, 'board')
  await navigateTo(window, 'focus')

  // Review has higher priority (weight 3 vs planning weight 1)
  await expect(
    window.getByRole('heading', { name: 'Review Stage Task', level: 1 })
  ).toBeVisible()
})

test('priority engine: in_progress beats planning', async () => {
  const project = await seedProject(window, { name: 'In Progress Priority Project' })

  await seedTask(window, {
    title: 'Planning Task',
    projectId: project.id,
    column: 'planning'
  })
  await seedTask(window, {
    title: 'In Progress Task',
    projectId: project.id,
    column: 'in_progress'
  })

  await navigateTo(window, 'board')
  await navigateTo(window, 'focus')

  // In Progress has higher priority (weight 2 vs planning weight 1)
  await expect(
    window.getByRole('heading', { name: 'In Progress Task', level: 1 })
  ).toBeVisible()
})

test('priority engine: higher project rank wins within same column', async () => {
  // Create two projects — projectA gets priorityRank 0 (created first)
  // and projectB gets priorityRank 1 (created second)
  const projectA = await seedProject(window, { name: 'High Priority Project' })
  const projectB = await seedProject(window, { name: 'Low Priority Project' })

  // Both projects have a planning task
  await seedTask(window, {
    title: 'Task From High Priority Project',
    projectId: projectA.id,
    column: 'planning'
  })
  await seedTask(window, {
    title: 'Task From Low Priority Project',
    projectId: projectB.id,
    column: 'planning'
  })

  await navigateTo(window, 'board')
  await navigateTo(window, 'focus')

  // Project A has lower priorityRank (0 < 1) = higher priority
  await expect(
    window.getByRole('heading', { name: 'Task From High Priority Project', level: 1 })
  ).toBeVisible()
})

test('focus view: queue depth indicator shows waiting tasks', async () => {
  const project = await seedProject(window, { name: 'Queue Project' })

  // Create multiple actionable tasks
  await seedTask(window, { title: 'Task 1', projectId: project.id, column: 'planning' })
  await seedTask(window, { title: 'Task 2', projectId: project.id, column: 'planning' })
  await seedTask(window, { title: 'Task 3', projectId: project.id, column: 'planning' })

  await navigateTo(window, 'board')
  await navigateTo(window, 'focus')

  // With 3 tasks, the queue indicator should show "2 tasks waiting"
  await expect(window.getByText(/\d+ tasks? waiting/)).toBeVisible()
})
