/**
 * E2E tests for T-003: Project Management UI
 */

import { test, expect } from '@playwright/test'
import {
  createTestDataDir,
  cleanupTestDataDir,
  launchApp,
  waitForReady,
  navigateTo
} from './helpers'
import { clearAllProjects } from './seed'
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
  // Start each test with a clean slate
  await clearAllProjects(window)
  await navigateTo(window, 'projects')
})

test('projects page renders with empty state', async () => {
  await expect(window.getByRole('heading', { name: 'Projects' })).toBeVisible()
  await expect(
    window.getByText('No projects yet. Create one to get started.')
  ).toBeVisible()
  await expect(window.getByRole('button', { name: 'New Project' })).toBeVisible()
})

test('create project: appears in project list', async () => {
  // Open the create project modal
  await window.getByRole('button', { name: 'New Project' }).click()
  await expect(window.getByRole('heading', { name: 'New Project' })).toBeVisible()

  // Fill in the project name
  await window.getByLabel('Name').fill('E2E Test Project')

  // Click Create
  await window.getByRole('button', { name: 'Create' }).click()

  // Toast and project in list
  await expect(window.getByText('Project created')).toBeVisible({ timeout: 5000 })
  await expect(window.getByText('E2E Test Project')).toBeVisible()
})

test('edit project: updated name displays', async () => {
  // Create a project first
  await window.getByRole('button', { name: 'New Project' }).click()
  await window.getByLabel('Name').fill('Original Name')
  await window.getByRole('button', { name: 'Create' }).click()
  await expect(window.getByText('Project created')).toBeVisible({ timeout: 5000 })

  // Click the Edit button on the project
  await window.getByRole('button', { name: 'Edit' }).click()
  await expect(window.getByRole('heading', { name: 'Edit Project' })).toBeVisible()

  // Change the name
  await window.getByLabel('Name').click({ clickCount: 3 })
  await window.getByLabel('Name').fill('Updated Name')

  // Save
  await window.getByRole('button', { name: 'Update' }).click()
  await expect(window.getByText('Project updated')).toBeVisible({ timeout: 5000 })

  // Updated name shows in list
  await expect(window.getByText('Updated Name')).toBeVisible()
})

test('delete project: removed from list after confirmation', async () => {
  // Create a project to delete
  await window.getByRole('button', { name: 'New Project' }).click()
  await window.getByLabel('Name').fill('Project To Delete')
  await window.getByRole('button', { name: 'Create' }).click()
  await expect(window.getByText('Project created')).toBeVisible({ timeout: 5000 })

  // Click the Delete button
  await window.getByRole('button', { name: 'Delete' }).click()

  // Confirm deletion in the dialog — use the dialog's Delete button specifically
  await expect(window.getByRole('heading', { name: 'Delete Project?' })).toBeVisible()
  await window.locator('[role="dialog"]').getByRole('button', { name: 'Delete' }).click()

  // Project is gone
  await expect(window.getByText('Project To Delete')).not.toBeVisible()
  await expect(
    window.getByText('No projects yet. Create one to get started.')
  ).toBeVisible()
})

test('cancel delete project: project remains in list', async () => {
  await window.getByRole('button', { name: 'New Project' }).click()
  await window.getByLabel('Name').fill('Keep This Project')
  await window.getByRole('button', { name: 'Create' }).click()
  await expect(window.getByText('Project created')).toBeVisible({ timeout: 5000 })

  // Open delete dialog then cancel
  await window.getByRole('button', { name: 'Delete' }).click()
  await expect(window.getByRole('heading', { name: 'Delete Project?' })).toBeVisible()
  await window.getByRole('button', { name: 'Cancel' }).click()

  // Project still in list
  await expect(window.getByText('Keep This Project')).toBeVisible()
})
