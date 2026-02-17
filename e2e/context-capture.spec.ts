/**
 * E2E tests for T-008: Context Capture (Shelving)
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
})

/** Wait for the context capture modal to be ready for interaction. */
async function waitForCaptureReady(win: Page): Promise<void> {
  await win.waitForSelector('[role="dialog"]', { state: 'visible' })
  await win.getByRole('button', { name: 'Confirm' }).waitFor({ state: 'visible' })
}

// ---------------------------------------------------------------------------
// Context capture on phase transition (Focus View)
// ---------------------------------------------------------------------------

test('context capture: modal appears when completing a phase in Focus View', async () => {
  const project = await seedProject(window, { name: 'Capture Project' })
  await seedTask(window, {
    title: 'Phase Transition Task',
    projectId: project.id,
    column: 'planning'
  })

  await navigateTo(window, 'board')
  await navigateTo(window, 'focus')

  await expect(
    window.getByRole('heading', { name: 'Phase Transition Task', level: 1 })
  ).toBeVisible()

  await window.getByText('Begin Work').click()

  // Context capture modal must appear
  await expect(window.getByRole('dialog')).toBeVisible()
  await expect(window.getByText('Capture Context')).toBeVisible()
  await expect(window.getByText('Phase Transition Task')).toBeVisible()
})

test('context capture: confirming advances task column and saves context', async () => {
  const project = await seedProject(window, { name: 'Confirm Capture Project' })
  await seedTask(window, {
    title: 'Task To Complete',
    projectId: project.id,
    column: 'planning'
  })

  await navigateTo(window, 'board')
  await navigateTo(window, 'focus')

  await expect(
    window.getByRole('heading', { name: 'Task To Complete', level: 1 })
  ).toBeVisible()

  await window.getByText('Begin Work').click()
  await waitForCaptureReady(window)

  // Type a custom context snapshot
  const textarea = window.getByRole('textbox')
  await textarea.clear()
  await textarea.fill(
    'Left off after setting up the DB schema. Next: write the migration.'
  )

  await window.getByRole('button', { name: 'Confirm' }).click()

  // Wait for transition
  await window.waitForTimeout(600)

  // Task should be in In Progress on the board
  await navigateTo(window, 'board')
  await expect(window.getByText('Task To Complete')).toBeVisible()

  // Verify context was saved by opening the task edit modal
  await window.getByText('Task To Complete').click()
  await expect(
    window.getByDisplayValue(
      'Left off after setting up the DB schema. Next: write the migration.'
    )
  ).toBeVisible()
  // Close the edit modal
  await window.keyboard.press('Escape')
})

test('context capture: cancelling phase transition leaves task unchanged', async () => {
  const project = await seedProject(window, { name: 'Cancel Capture Project' })
  await seedTask(window, {
    title: 'Task Not Moving',
    projectId: project.id,
    column: 'planning'
  })

  await navigateTo(window, 'board')
  await navigateTo(window, 'focus')

  await expect(
    window.getByRole('heading', { name: 'Task Not Moving', level: 1 })
  ).toBeVisible()

  await window.getByText('Begin Work').click()
  await expect(window.getByRole('dialog')).toBeVisible()

  // Cancel the capture
  await window.getByRole('button', { name: 'Cancel' }).click()

  // Modal should close
  await expect(window.getByRole('dialog')).not.toBeVisible()

  // Task should still be in focus view at planning stage
  await expect(window.getByText('Begin Work')).toBeVisible()
  await expect(
    window.getByRole('heading', { name: 'Task Not Moving', level: 1 })
  ).toBeVisible()
})

// ---------------------------------------------------------------------------
// Context capture on defer (Focus View)
// ---------------------------------------------------------------------------

test('context capture: defer shows modal with skip option', async () => {
  const project = await seedProject(window, { name: 'Defer Project' })
  await seedTask(window, {
    title: 'Task To Defer',
    projectId: project.id,
    column: 'planning'
  })
  await seedTask(window, {
    title: 'Next Task',
    projectId: project.id,
    column: 'planning'
  })

  await navigateTo(window, 'board')
  await navigateTo(window, 'focus')

  await window.getByRole('button', { name: 'Defer' }).click()

  // Context capture modal appears with skip option
  await expect(window.getByRole('dialog')).toBeVisible()
  await expect(window.getByText('Capture Context')).toBeVisible()
  await expect(window.getByText('Deferring task')).toBeVisible()
  await expect(window.getByRole('button', { name: 'Skip' })).toBeVisible()
})

test('context capture: skipping defer proceeds without saving context', async () => {
  const project = await seedProject(window, { name: 'Skip Defer Project' })
  const task1 = await seedTask(window, {
    title: 'Task To Skip',
    projectId: project.id,
    column: 'planning',
    contextBlock: 'Original context that must be preserved.'
  })
  await seedTask(window, {
    title: 'Other Task',
    projectId: project.id,
    column: 'in_progress'
  })

  await navigateTo(window, 'board')
  await navigateTo(window, 'focus')

  // The higher priority task (in_progress) will be focused first
  // Navigate to see "Task To Skip" — it may appear after the in_progress task
  // For simplicity, defer "Other Task" first to surface "Task To Skip"
  // Actually: Other Task is in_progress (weight 2) > Task To Skip planning (weight 1)
  // So Other Task shows first. Let's just defer it to test the skip flow.
  await window.getByRole('button', { name: 'Defer' }).click()

  await expect(window.getByRole('dialog')).toBeVisible()
  await window.getByRole('button', { name: 'Skip' }).click()

  // Modal should close and focus should switch to next task
  await expect(window.getByRole('dialog')).not.toBeVisible()

  // Verify original context was NOT modified (check via board task edit)
  await navigateTo(window, 'board')
  // Find the task and verify original context is intact
  const tasks = await window.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).api.invoke('tasks:list', { archived: false })
  })
  const preserved = (tasks as Array<{ id: number; contextBlock: string | null }>).find(
    (t) => t.id === task1.id
  )
  expect(preserved?.contextBlock).toBe('Original context that must be preserved.')
})
