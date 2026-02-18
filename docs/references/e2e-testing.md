# E2E Testing Guide

Chaos Coordinator uses [Playwright](https://playwright.dev/) with its Electron integration for end-to-end tests. Tests live in the `e2e/` directory.

## Running E2E Tests

```bash
# Build the app first (e2e tests run against the built output)
npm run build

# Run all e2e tests
npx playwright test

# Run a specific spec file
npx playwright test e2e/board-view.spec.ts

# Run in headed mode (see the app window)
npx playwright test --headed

# Run with a specific test name
npx playwright test --grep "board renders column headers"
```

> **Important:** E2E tests run against the built app (`./out/main/index.js`). Always run `npm run build` before running tests, or you'll be testing stale code.

## Test Structure

```
e2e/
  helpers.ts              — App lifecycle + navigation helpers
  seed.ts                 — Test data seeding utilities
  app.spec.ts             — Smoke test (app launches)
  settings.spec.ts        — T-013: Configuration System
  projects.spec.ts        — T-003: Project Management UI
  board-view.spec.ts      — T-005: Board View
  focus-view.spec.ts      — T-004 + T-001: Focus View + Priority Engine
  context-capture.spec.ts — T-008: Context Capture (Shelving)
```

## Writing a New E2E Test

### File setup

Create `e2e/my-feature.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'
import {
  createTestDataDir,
  cleanupTestDataDir,
  launchApp,
  waitForReady,
  navigateTo
} from './helpers'
import { seedProject, seedTask } from './seed'
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

test('my feature does something', async () => {
  await navigateTo(window, 'board')
  await expect(window.getByText('Board')).toBeVisible()
})
```

### Test isolation pattern

Each spec file gets its **own Electron instance** with a **fresh temp directory** as `userData`. This ensures tests in different files don't share state. Tests within the same file share an app instance — use `beforeEach` to clear data between them if needed:

```typescript
import { clearAllProjects } from './seed'

test.beforeEach(async () => {
  await clearAllProjects(window)
})
```

### Navigation

Use `navigateTo(window, route)` to switch between views:

```typescript
await navigateTo(window, 'focus') // /focus
await navigateTo(window, 'board') // /board
await navigateTo(window, 'archive') // /archive
await navigateTo(window, 'projects') // /projects
await navigateTo(window, 'settings') // /settings
```

## Seeding Test Data

The `e2e/seed.ts` module provides helpers that seed data through the IPC bridge — the same path the real app uses.

```typescript
import { seedProject, seedTask, clearAllProjects } from './seed'

// Create a project
const project = await seedProject(window, {
  name: 'My Project',
  colorPrimary: '#6366f1', // optional, has defaults
  colorAccent: '#818cf8' // optional, has defaults
})
// project.id is available immediately

// Create a task in that project
const task = await seedTask(window, {
  title: 'My Task',
  projectId: project.id,
  column: 'planning' // backlog | planning | in_progress | review
})

// Clear all projects (useful in beforeEach)
await clearAllProjects(window)
```

### How seeding works

Seeding calls `window.api.invoke()` from the renderer context via Playwright's `page.evaluate()`. This goes through the normal IPC channel, so the data is written to the real SQLite database in the test's temp directory.

After seeding, navigate away and back to the target view to trigger a data reload:

```typescript
const project = await seedProject(window, { name: 'Test Project' })

// Reload to pick up seeded data
await navigateTo(window, 'focus')
await navigateTo(window, 'board')

await expect(window.getByText('Test Project')).toBeVisible()
```

## Test Isolation (userData Temp Dir)

Each test file calls `createTestDataDir()` which:

1. Creates a unique temp directory (e.g., `/tmp/chaos-coordinator-test-abc123/`)
2. Writes a `config.json` with a fake LLM API key so the app doesn't redirect to the first-run settings screen

The app reads `CHAOS_COORDINATOR_TEST_DATA` env var (set by `launchApp({ testDataDir })`) and calls `app.setPath('userData', ...)` to use the temp dir for the database and config.

This means every spec file gets a completely clean database — no cross-file state leakage.

## Debugging Failing Tests

### See what's on screen

Use `--headed` to watch the tests run live:

```bash
npx playwright test --headed --slow-mo 500
```

### Screenshots on failure

Add to `playwright.config.ts`:

```typescript
use: {
  screenshot: 'only-on-failure',
  trace: 'on-first-retry'
}
```

Then check `playwright-report/` after a run.

### View traces

```bash
npx playwright show-report
```

Or open a trace file directly:

```bash
npx playwright show-trace test-results/*/trace.zip
```

### Debug a specific test interactively

```bash
npx playwright test --debug e2e/board-view.spec.ts
```

### Console logs from the app

In your test, capture renderer console output:

```typescript
window.on('console', (msg) => {
  console.log('APP:', msg.text())
})
```

## Common Pitfalls

**Tests fail with "app not found"**: Run `npm run build` first.

**Tests fail after running `npm run validate`**: The Vitest pretest script rebuilds `better-sqlite3` for the system Node.js version, which breaks Electron compatibility. The Playwright global setup (`e2e/global-setup.ts`) automatically rebuilds for Electron before tests run — so `npx playwright test` handles this. If running tests outside of Playwright (e.g., directly via Electron), run `./node_modules/.bin/electron-rebuild -f -w better-sqlite3` manually.

**Timing issues**: Use `waitForSelector`, `waitForFunction`, or `expect().toBeVisible()` rather than `waitForTimeout()`. Fixed-time waits are fragile.

**Seeded data not visible**: Navigate away and back to the view to trigger a reload after seeding.

**"LLM not configured" redirect**: The temp dir approach pre-seeds a fake API key. If a test bypasses `createTestDataDir()`, the app will redirect to Settings. Always use `createTestDataDir()` and `launchApp({ testDataDir })`.

**Flaky drag tests**: HTML5 drag-and-drop in Electron can be unreliable with Playwright. Prefer testing column changes via the edit modal (select dropdown) rather than drag-and-drop.
