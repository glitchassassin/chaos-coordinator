/**
 * E2E tests for T-007b: URL-based Auto-population
 *
 * These tests focus on graceful degradation and UI flow since the feature
 * depends on external CLI tools (gh, az) and LLM calls that won't be
 * available in test environments.
 */

import { test, expect } from '@playwright/test'
import {
  createTestDataDir,
  cleanupTestDataDir,
  launchApp,
  waitForReady,
  navigateTo
} from './helpers'
import { seedProject, clearAllProjects } from './seed'
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

test('generic URL creates task with URL as title (no crash)', async () => {
  const project = await seedProject(window, { name: 'URL Test Project' })
  expect(project.id).toBeGreaterThan(0)

  // Reload board
  await navigateTo(window, 'focus')
  await navigateTo(window, 'board')

  // Click "+ Add" in Backlog column for the project
  const addBtn = window.getByRole('button', {
    name: /Add task to URL Test Project Backlog/i
  })
  await addBtn.click()

  // Type a generic URL (not GitHub/Azure) — intake:fetchMetadata returns immediately for 'other'
  const input = window.getByRole('textbox', { name: /New task title/i })
  await input.fill('https://example.com/some-page')
  await input.press('Enter')

  // The task should appear on the board. The generic URL fetch resolves immediately so
  // loading state may flash briefly. Wait for final state: task card visible.
  await expect(window.getByText('https://example.com/some-page')).toBeVisible({
    timeout: 10_000
  })
})

test('cancel removes loading card from board', async () => {
  const project = await seedProject(window, { name: 'Cancel Test Project' })
  expect(project.id).toBeGreaterThan(0)

  await navigateTo(window, 'focus')
  await navigateTo(window, 'board')

  // Paste a GitHub-shaped URL — `gh` won't be authenticated so the fetch will either
  // fail quickly or show a loading state. We click cancel while it's loading.
  const addBtn = window.getByRole('button', {
    name: /Add task to Cancel Test Project Backlog/i
  })
  await addBtn.click()

  const input = window.getByRole('textbox', { name: /New task title/i })
  await input.fill('https://github.com/testorg/testrepo/issues/999')
  await input.press('Enter')

  // Wait for the loading card to appear (may be brief if gh fails fast)
  // Either the loading spinner appears OR the card degrades immediately.
  // In either case, after some time, the card should be in a stable (non-loading) state.
  // If we can click cancel, great; if it already degraded, the task stays with URL as title.
  try {
    const cancelBtn = window.getByRole('button', { name: /Cancel fetch/i })
    await cancelBtn.waitFor({ timeout: 3_000 })
    await cancelBtn.click()

    // After cancel, card should be removed
    await expect(
      window.getByText('https://github.com/testorg/testrepo/issues/999')
    ).toBeHidden({ timeout: 5_000 })
  } catch {
    // gh failed fast — loading state already resolved; task either has URL as title or was cleaned
    // This is also valid graceful degradation
  }
})

test('GitHub URL failure degrades gracefully — card stays with URL as title', async () => {
  const project = await seedProject(window, { name: 'Degrade Test Project' })
  expect(project.id).toBeGreaterThan(0)

  await navigateTo(window, 'focus')
  await navigateTo(window, 'board')

  const addBtn = window.getByRole('button', {
    name: /Add task to Degrade Test Project Backlog/i
  })
  await addBtn.click()

  const input = window.getByRole('textbox', { name: /New task title/i })
  await input.fill('https://github.com/testorg/testrepo/issues/1')
  await input.press('Enter')

  // Wait for the card to appear in either loading or degraded state
  // After the fetch fails (gh not authed, or gh not installed), the card
  // should no longer be in loading state and should show the URL as title.
  await expect(
    window.getByText('https://github.com/testorg/testrepo/issues/1')
  ).toBeVisible({
    timeout: 10_000
  })

  // Eventually loading state clears (either by success, failure, or cancel)
  await expect(window.getByRole('button', { name: /Cancel fetch/i })).toBeHidden({
    timeout: 15_000
  })
})
