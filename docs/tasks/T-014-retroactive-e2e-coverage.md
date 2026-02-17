---
id: T-014
title: 'Retroactive E2E Test Coverage'
status: done
priority: 3
dependencies: []
spec_refs: []
adrs: ['008']
estimated_complexity: L
tags: [testing, infrastructure, e2e]
created: 2026-02-17
updated: 2026-02-17
---

# T-014: Retroactive E2E Test Coverage

## Context

Tasks T-001 through T-005 (plus T-013) were implemented with unit tests only — no automated end-to-end tests. The existing e2e infrastructure is a single Playwright smoke test that verifies the app launches. This task adds meaningful e2e coverage for all completed functionality, and establishes the patterns and helpers that future tasks will use for their own e2e tests.

## Goals

1. **Establish e2e testing infrastructure** — helpers for app lifecycle, test data seeding, and common interactions.
2. **Cover every completed feature** with at least one e2e test exercising its core user-facing behavior.
3. **Document patterns** so future tasks can add their own e2e tests consistently.

## Requirements

### Infrastructure

1. **Test data helpers**: Create utilities for seeding the database with test projects, tasks, triggers, and column history. E2e tests need deterministic starting state — either a fresh DB per test or a known seed. Since the app uses SQLite, the simplest approach is to ensure a clean `userData` directory per test run.

2. **App lifecycle helpers**: Extend `e2e/helpers.ts` with:
   - `launchApp()` — already exists; enhance to support environment overrides (e.g., custom userData path for test isolation)
   - `waitForReady(window)` — wait until the app is fully loaded (not just the window title, but the main content rendered)
   - Common navigation helpers (go to Board View, Focus View, Projects, Settings, Archive)

3. **IPC bridge for seeding**: The cleanest way to seed test data is to call IPC handlers directly from the test. Playwright's Electron support allows `electronApplication.evaluate()` to run code in the main process. Use this to call the database layer directly for setup/teardown, avoiding fragile UI-based data creation in test setup.

### E2E Tests for Completed Tasks

#### T-013: Configuration System

4. **Settings flow**: Open settings → enter/change a configuration value → save → verify the value persists after closing and reopening settings. (Skip API key tests — don't store real keys in e2e.)

#### T-003: Project Management UI

5. **Create project**: Navigate to Projects → create a project with a name and colors → verify it appears in the project list.
6. **Edit project**: Click an existing project → change its name → save → verify the updated name displays.
7. **Delete project**: Delete a project → confirm the dialog → verify it's removed from the list.

#### T-005: Board View

8. **Board renders**: Navigate to Board View with seeded data → verify columns render (Backlog, Planning, In Progress, Review) → verify task cards appear in correct columns and swim lanes.
9. **Quick-add task**: Use the quick-add feature to create a task → verify it appears on the board in the correct column.
10. **Card edit**: Click a task card → edit its title → save → verify the change persists.
11. **Column drag**: Drag a card from one column to another → verify the card moves and the change persists after refresh. Note: Playwright's `dragTo()` may not work reliably with `@dnd-kit`'s event model — prefer using keyboard-based drag (`Space` to pick up, `Arrow` to move, `Space` to drop) which `@dnd-kit` supports and is more Playwright-friendly.

#### T-004: Focus View

12. **Focus task displays**: With seeded tasks, navigate to Focus View → verify the highest-priority task renders with its title, project name, and project colors.
13. **Complete action**: Click "complete phase" → verify the task advances to the next column and the next task (or empty state) appears.
14. **Empty state**: With no actionable tasks, verify the empty state message renders.

#### T-001: Priority Engine (tested via Focus View)

15. **Priority ordering**: Seed tasks across different columns and projects → navigate to Focus View → verify the correct task surfaces (review > in_progress > planning; higher project rank wins within same column).

#### T-002: LLM Integration (tested via Settings)

16. **LLM status**: Verify the settings UI shows LLM configuration fields and reflects the current connection status (configured vs. not configured). No actual LLM calls in e2e — just verify the UI reflects the state.

### Documentation

17. **E2E testing guide**: Add `docs/references/e2e-testing.md` documenting:
    - How to run e2e tests (`npx playwright test`)
    - How to write a new e2e test (file naming, helpers, patterns)
    - How to seed test data via the IPC bridge
    - How to debug failing e2e tests (traces, screenshots)

## Existing Code

- **Playwright config**: `playwright.config.ts` — basic config with `testDir: './e2e'`
- **Helpers**: `e2e/helpers.ts` — `launchApp()` function
- **Smoke test**: `e2e/app.spec.ts` — single "app launches" test
- **All IPC handlers**: `src/main/ipc/` — full CRUD for projects, tasks, config
- **DB layer**: `src/main/db/` — Drizzle ORM with better-sqlite3

## Implementation Notes

### Test isolation

Each test (or test file) should get a clean app state. Options:

- **Environment variable for userData path**: Pass a temp directory as `CHAOS_COORDINATOR_TEST_DATA` that the app reads instead of `app.getPath('userData')`. Each test creates a temp dir, launches the app pointed at it, and cleans up after.
- **Main process evaluate**: Use `app.evaluate()` to reset the database between tests if sharing an app instance for speed.

The temp directory approach is more robust. The app likely already uses `app.getPath('userData')` — add an env var override for testing.

### File organization

```
e2e/
  helpers.ts              — enhanced app lifecycle + navigation helpers
  seed.ts                 — test data seeding utilities (via electronApplication.evaluate)
  app.spec.ts             — existing smoke test (keep as-is)
  settings.spec.ts        — T-013 e2e tests
  projects.spec.ts        — T-003 e2e tests
  board-view.spec.ts      — T-005 e2e tests
  focus-view.spec.ts      — T-004 + T-001 e2e tests
```

### Navigation helpers

```typescript
// Example patterns — not prescriptive implementation
async function navigateTo(
  window: Page,
  route: 'board' | 'focus' | 'projects' | 'settings' | 'archive'
) {
  // Click the nav link for the target route
  // Wait for the view to render
}
```

### Seeding via main process

```typescript
// Example pattern
async function seedProject(
  app: ElectronApplication,
  data: { name: string; colorPrimary?: string }
) {
  return app.evaluate(async ({ ipcMain }, data) => {
    // Call the database layer directly
  }, data)
}
```

## Testing Requirements

This task IS the testing task. Success criteria:

- All e2e tests pass with `npx playwright test`
- Each test file covers the scenarios listed above
- Tests are deterministic — no flaky failures from timing or state leakage
- Total e2e suite runs in under 60 seconds
- The existing smoke test (`app.spec.ts`) continues to pass

## Verification

1. `npx playwright test` — all e2e tests pass.
2. `npm run validate` — existing unit tests still pass, no regressions.
3. Review the e2e testing guide in `docs/references/e2e-testing.md`.
4. Intentionally break a feature (e.g., comment out the Focus View rendering) — verify the relevant e2e test catches it.
