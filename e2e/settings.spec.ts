/**
 * E2E tests for T-013: Configuration System (Settings view)
 */

import { test, expect } from '@playwright/test'
import {
  createTestDataDir,
  cleanupTestDataDir,
  launchApp,
  waitForReady,
  navigateTo
} from './helpers'
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

test('settings page displays LLM configuration fields', async () => {
  await navigateTo(window, 'settings')

  // The settings heading is present
  await expect(window.getByRole('heading', { name: 'Settings' })).toBeVisible()

  // LLM group heading is visible
  await expect(window.getByRole('heading', { name: 'LLM' })).toBeVisible()

  // All three LLM fields are rendered
  await expect(window.getByLabel('API Key')).toBeVisible()
  await expect(window.getByLabel('Model')).toBeVisible()
  // Provider is a select element labelled by its id
  await expect(window.locator('#llm\\.provider')).toBeVisible()
})

test('API key shows Configured badge when pre-seeded', async () => {
  await navigateTo(window, 'settings')

  // The fake API key written by createTestDataDir() should cause the
  // "Configured" badge to appear on the API Key field
  await expect(window.getByText('Configured')).toBeVisible()
})

test('changing llm.model saves and persists', async () => {
  await navigateTo(window, 'settings')

  const modelInput = window.getByLabel('Model')

  // Clear the current value and type a new one
  await modelInput.click({ clickCount: 3 })
  await modelInput.fill('openai/gpt-4o')

  // Trigger save by pressing Enter
  await modelInput.press('Enter')

  // Wait for the "Saved" toast
  await expect(window.getByText('Saved')).toBeVisible({ timeout: 5000 })

  // Navigate away and back to verify persistence
  await navigateTo(window, 'board')
  await navigateTo(window, 'settings')

  // The model field should now display the updated value
  await expect(window.getByLabel('Model')).toHaveValue('openai/gpt-4o')
})

test('resetting llm.model restores default value', async () => {
  await navigateTo(window, 'settings')

  // Click the "Reset to default" button for the Model field
  // The reset button is next to the Model label
  const modelSection = window
    .locator('div')
    .filter({ hasText: /^Model/ })
    .first()
  await modelSection.getByText('Reset to default').click()

  // Navigate away and back to verify the default is restored
  await navigateTo(window, 'board')
  await navigateTo(window, 'settings')

  await expect(window.getByLabel('Model')).toHaveValue('anthropic/claude-3.5-sonnet')
})
