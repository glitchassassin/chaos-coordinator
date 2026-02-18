/**
 * E2E tests for T-007a: Task Edit — Links Support
 */

import { test, expect } from '@playwright/test'
import {
  createTestDataDir,
  cleanupTestDataDir,
  launchApp,
  waitForReady,
  navigateTo
} from './helpers'
import { seedProject, seedTask, seedLink, clearAllProjects } from './seed'
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
  await navigateTo(window, 'board')
})

test('add link: saves and persists across modal reopen', async () => {
  const project = await seedProject(window, { name: 'Link Test Project' })
  const task = await seedTask(window, { title: 'Link Task', projectId: project.id })

  await navigateTo(window, 'focus')
  await navigateTo(window, 'board')

  // Open task edit modal
  await window.getByText(task.title).click()
  await expect(window.getByText('Edit Task')).toBeVisible()

  // Add a link
  await window.getByText('+ Add link').click()
  await window.getByLabel('Link URL').fill('https://github.com/org/repo/issues/42')
  await window.getByLabel('Link label').fill('Issue #42')

  // Save
  await window.getByRole('button', { name: 'Save' }).click()
  await expect(window.getByText('Task updated')).toBeVisible()

  // Reopen the modal
  await window.getByText(task.title).click()
  await expect(window.getByText('Edit Task')).toBeVisible()

  // Verify link persists
  await expect(window.getByText('Issue #42')).toBeVisible()
})

test('remove link: disappears and stays gone after reopen', async () => {
  const project = await seedProject(window, { name: 'Remove Link Project' })
  const task = await seedTask(window, { title: 'Task With Link', projectId: project.id })
  await seedLink(window, {
    taskId: task.id,
    url: 'https://github.com/org/repo/issues/99',
    label: 'Issue #99'
  })

  await navigateTo(window, 'focus')
  await navigateTo(window, 'board')

  // Open task edit modal
  await window.getByText(task.title).click()
  await expect(window.getByText('Edit Task')).toBeVisible()

  // Verify link is shown
  await expect(window.getByText('Issue #99')).toBeVisible()

  // Remove the link — disappears from UI immediately but Save commits the delete
  await window.getByLabel('Remove link Issue #99').click()
  await expect(window.getByText('Issue #99')).not.toBeVisible()

  // Save to commit the deletion
  await window.getByRole('button', { name: 'Save' }).click()
  await window.getByText(task.title).click()
  await expect(window.getByText('Edit Task')).toBeVisible()

  // Verify link is gone
  await expect(window.getByText('Issue #99')).not.toBeVisible()
})
