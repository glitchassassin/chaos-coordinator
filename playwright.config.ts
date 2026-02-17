import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  // Electron apps are heavyweight and can't start in parallel reliably.
  // Run one test file at a time to avoid resource contention.
  workers: 1,
  // Rebuild the native module for Electron before tests run.
  // The Vitest pretest script rebuilds better-sqlite3 for system Node.js
  // (unit tests), which is incompatible with Electron's embedded Node.js.
  globalSetup: './e2e/global-setup.ts',
  use: {
    trace: 'on-first-retry'
  }
})
