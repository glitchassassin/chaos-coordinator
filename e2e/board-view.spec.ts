/**
 * E2E tests for T-005: Board View
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
  await navigateTo(window, 'board')
})

test('board renders empty state when no projects exist', async () => {
  await expect(
    window.getByText('No projects or tasks yet. Create a project to get started.')
  ).toBeVisible()
})

test('board renders column headers', async () => {
  const project = await seedProject(window, { name: 'Test Project' })
  expect(project.id).toBeGreaterThan(0)

  // Reload the board
  await navigateTo(window, 'focus')
  await navigateTo(window, 'board')

  await expect(window.getByText('Backlog')).toBeVisible()
  await expect(window.getByText('Planning')).toBeVisible()
  await expect(window.getByText('In Progress')).toBeVisible()
  await expect(window.getByText('Review/Verify')).toBeVisible()
})

test('board renders task cards in correct columns', async () => {
  const project = await seedProject(window, { name: 'Column Test Project' })
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
  await seedTask(window, {
    title: 'Review Task',
    projectId: project.id,
    column: 'review'
  })
  await seedTask(window, {
    title: 'Backlog Task',
    projectId: project.id,
    column: 'backlog'
  })

  // Reload the board
  await navigateTo(window, 'focus')
  await navigateTo(window, 'board')

  // All task cards should appear
  await expect(window.getByText('Planning Task')).toBeVisible()
  await expect(window.getByText('In Progress Task')).toBeVisible()
  await expect(window.getByText('Review Task')).toBeVisible()
  await expect(window.getByText('Backlog Task')).toBeVisible()

  // Project swim lane label is visible
  await expect(window.getByText('Column Test Project')).toBeVisible()
})

test('quick-add task: creates a task in the specified column', async () => {
  const project = await seedProject(window, { name: 'Quick Add Project' })
  expect(project.id).toBeGreaterThan(0)

  await navigateTo(window, 'focus')
  await navigateTo(window, 'board')

  // Click the "+ Add" button in the Planning column of our project's swim lane
  const addButton = window.getByRole('button', {
    name: `Add task to Quick Add Project Planning`
  })
  await addButton.click()

  // An inline input should appear
  const titleInput = window.getByRole('textbox', { name: 'New task title' })
  await expect(titleInput).toBeVisible()
  await titleInput.fill('Quick Added Task')

  // Save by pressing Enter
  await titleInput.press('Enter')

  // Toast and task card appear
  await expect(window.getByText('Task created')).toBeVisible({ timeout: 5000 })
  await expect(window.getByText('Quick Added Task')).toBeVisible()
})

test('quick-add task: cancel discards the inline input', async () => {
  const project = await seedProject(window, { name: 'Cancel Add Project' })
  expect(project.id).toBeGreaterThan(0)

  await navigateTo(window, 'focus')
  await navigateTo(window, 'board')

  const addButton = window.getByRole('button', {
    name: `Add task to Cancel Add Project Planning`
  })
  await addButton.click()

  const titleInput = window.getByRole('textbox', { name: 'New task title' })
  await expect(titleInput).toBeVisible()
  await titleInput.fill('Should Not Be Created')

  // Cancel — use exact match to avoid matching aria-labels that contain "Cancel"
  await window.getByRole('button', { name: 'Cancel', exact: true }).click()

  // The inline input is gone and the task was not created
  await expect(titleInput).not.toBeVisible()
  await expect(window.getByText('Should Not Be Created')).not.toBeVisible()
})

test('card edit: update task title and verify persistence', async () => {
  const project = await seedProject(window, { name: 'Edit Project' })
  await seedTask(window, {
    title: 'Original Title',
    projectId: project.id,
    column: 'planning'
  })

  await navigateTo(window, 'focus')
  await navigateTo(window, 'board')

  // Click the task card to open the edit modal
  await window.getByText('Original Title').click()
  await expect(window.getByRole('heading', { name: 'Edit Task' })).toBeVisible()

  // Update the title
  const titleInput = window.locator('#edit-title')
  await titleInput.click({ clickCount: 3 })
  await titleInput.fill('Updated Title')

  // Save
  await window.getByRole('button', { name: 'Save' }).click()
  await expect(window.getByText('Task updated')).toBeVisible({ timeout: 5000 })

  // Verify the updated title is visible on the board
  await expect(window.getByText('Updated Title')).toBeVisible()
  await expect(window.getByText('Original Title')).not.toBeVisible()

  // Navigate away and back to verify persistence
  await navigateTo(window, 'focus')
  await navigateTo(window, 'board')
  await expect(window.getByText('Updated Title')).toBeVisible()
})

test('card edit modal: column change via select persists', async () => {
  const project = await seedProject(window, { name: 'Column Move Project' })
  await seedTask(window, { title: 'Move Me', projectId: project.id, column: 'planning' })

  await navigateTo(window, 'focus')
  await navigateTo(window, 'board')

  // Open edit modal
  await window.getByText('Move Me').click()
  await expect(window.getByRole('heading', { name: 'Edit Task' })).toBeVisible()

  // Change column to In Progress using the select
  await window.locator('#edit-column').selectOption('in_progress')

  // Save
  await window.getByRole('button', { name: 'Save' }).click()
  await expect(window.getByText('Task updated')).toBeVisible({ timeout: 5000 })

  // Navigate away and back
  await navigateTo(window, 'focus')
  await navigateTo(window, 'board')

  // Task still visible (in its new column)
  await expect(window.getByText('Move Me')).toBeVisible()
})
