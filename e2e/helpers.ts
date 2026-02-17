import { _electron as electron } from 'playwright'
import type { ElectronApplication, Page } from 'playwright'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

export interface LaunchOptions {
  /** Custom userData directory for test isolation. */
  testDataDir?: string
}

/**
 * Create a temporary directory for test isolation.
 * Pre-populates config.json with a fake LLM API key so the app doesn't
 * redirect to the first-run Settings screen.
 */
export function createTestDataDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'chaos-coordinator-test-'))
  // Write a minimal config so llm:checkHealth returns { configured: true }.
  // The ConfigStore reads unencrypted values as plain strings, so this works
  // without needing Electron's safeStorage.
  writeFileSync(
    join(dir, 'config.json'),
    JSON.stringify({ 'llm.apiKey': 'e2e-test-key' })
  )
  return dir
}

/**
 * Remove a test data directory created by createTestDataDir().
 */
export function cleanupTestDataDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors — the OS will reclaim temp space eventually
  }
}

/**
 * Launch the Electron app.
 * Pass `testDataDir` (from createTestDataDir()) for test isolation.
 */
export async function launchApp(
  options: LaunchOptions = {}
): Promise<ElectronApplication> {
  const env: Record<string, string> = {}

  if (options.testDataDir) {
    env['CHAOS_COORDINATOR_TEST_DATA'] = options.testDataDir
  }

  return electron.launch({
    args: ['./out/main/index.js'],
    env: { ...process.env, ...env } as Record<string, string>
  })
}

/**
 * Wait until the app's main UI is ready.
 * Specifically, wait for the nav bar to appear and the initial "Loading..."
 * spinner to disappear.
 */
export async function waitForReady(window: Page): Promise<void> {
  // Nav appears once isConfigured is resolved in App.tsx
  await window.waitForSelector('nav', { timeout: 15000 })
  // Make sure the Loading... state is gone
  await window.waitForFunction(() => !document.body.textContent?.includes('Loading...'), {
    timeout: 10000
  })
}

export type AppRoute = 'board' | 'focus' | 'projects' | 'settings' | 'archive'

const ROUTE_LABELS: Record<AppRoute, string> = {
  board: 'Board',
  focus: 'Focus',
  projects: 'Projects',
  settings: 'Settings',
  archive: 'Archive'
}

/**
 * Navigate to a named route by clicking its nav link.
 */
export async function navigateTo(window: Page, route: AppRoute): Promise<void> {
  await window.getByRole('link', { name: ROUTE_LABELS[route] }).click()
  // Allow the route transition to settle
  await window.waitForTimeout(300)
}
