/**
 * E2E tests for T-006: Archive View
 */

import { test, expect } from '@playwright/test'
import {
  createTestDataDir,
  cleanupTestDataDir,
  launchApp,
  waitForReady,
  navigateTo
} from './helpers'
import {
  seedProject,
  seedArchivedTask,
  seedColumnHistory,
  clearAllProjects
} from './seed'
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
  await navigateTo(window, 'archive')
})

test('archive view shows empty state when no archived tasks exist', async () => {
  await expect(window.getByText('No completed tasks yet.')).toBeVisible()
})

test('archive view displays archived task titles and project names', async () => {
  const project = await seedProject(window, {
    name: 'Archive Project',
    colorPrimary: '#6366f1'
  })
  await seedArchivedTask(window, {
    title: 'Completed Feature',
    projectId: project.id,
    contextBlock: 'Done and shipped.'
  })

  // Reload archive view
  await navigateTo(window, 'board')
  await navigateTo(window, 'archive')

  await expect(window.getByText('Completed Feature')).toBeVisible()
  await expect(window.getByText('Archive Project')).toBeVisible()
})

test('archive view shows column history timeline after expanding a card', async () => {
  const project = await seedProject(window, { name: 'History Project' })
  const task = await seedArchivedTask(window, {
    title: 'Task With History',
    projectId: project.id
  })
  await seedColumnHistory(window, {
    taskId: task.id,
    fromColumn: 'planning',
    toColumn: 'in_progress',
    contextSnapshot: 'Started coding.'
  })

  await navigateTo(window, 'board')
  await navigateTo(window, 'archive')

  await expect(window.getByText('Task With History')).toBeVisible()

  // Click to expand
  await window.getByRole('button', { name: /task with history/i }).click()

  // Column transition visible
  await expect(window.getByText('Planning')).toBeVisible()
  await expect(window.getByText('In Progress')).toBeVisible()
  await expect(window.getByText('Started coding.')).toBeVisible()
})

test('archive view: search filters tasks by title', async () => {
  const project = await seedProject(window, { name: 'Search Project' })
  await seedArchivedTask(window, { title: 'Auth refactor', projectId: project.id })
  await seedArchivedTask(window, { title: 'UI polishing', projectId: project.id })

  await navigateTo(window, 'board')
  await navigateTo(window, 'archive')

  await expect(window.getByText('Auth refactor')).toBeVisible()
  await expect(window.getByText('UI polishing')).toBeVisible()

  // Type in search
  await window.getByRole('searchbox', { name: /search archived tasks/i }).fill('auth')

  await expect(window.getByText('Auth refactor')).toBeVisible()
  await expect(window.getByText('UI polishing')).not.toBeVisible()
})

test('archive view: search shows no-results message when nothing matches', async () => {
  const project = await seedProject(window, { name: 'No Match Project' })
  await seedArchivedTask(window, { title: 'Fix login bug', projectId: project.id })

  await navigateTo(window, 'board')
  await navigateTo(window, 'archive')

  await expect(window.getByText('Fix login bug')).toBeVisible()

  await window
    .getByRole('searchbox', { name: /search archived tasks/i })
    .fill('xyzzy9999')

  await expect(window.getByText('No tasks match your search.')).toBeVisible()
  await expect(window.getByText('Fix login bug')).not.toBeVisible()
})
