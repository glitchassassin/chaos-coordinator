# Code Reviewer Agent Memory

## Project Patterns

### Testing Patterns

- Most view tests use `Object.defineProperty(window, 'api', {...})` for mocking `window.api`
- FocusView test uses `vi.stubGlobal('api', {...})` -- inconsistent but both work
- ContextCapture test also uses `vi.stubGlobal('api', {...})` -- same pattern as FocusView
- Existing test files: `App.test.tsx`, `BoardView.test.tsx`, `ProjectsView.test.tsx`, `SettingsView.test.tsx`, `FocusView.test.tsx`, `ContextCapture.test.tsx`
- Tests use `@testing-library/react` + `userEvent` + `vitest`
- Coverage: 80% overall, 90%+ for critical business logic (priority engine, trigger system, command safety)
- Coverage thresholds enforced globally (80%) in `vitest.config.ts` lines 59-64, not per-file

### E2E Testing Patterns

- Playwright config: `playwright.config.ts` (testDir: `./e2e`, 30s timeout, workers: 1)
- Global setup: `e2e/global-setup.ts` rebuilds better-sqlite3 for Electron
- E2E files: `app.spec.ts` (smoke), `board-view.spec.ts`, `focus-view.spec.ts`, `projects.spec.ts`, `settings.spec.ts`, `context-capture.spec.ts`, `task-links.spec.ts`
- Helpers: `e2e/helpers.ts` (launchApp, waitForReady, navigateTo, createTestDataDir, cleanupTestDataDir)
- Seed utils: `e2e/seed.ts` (seedProject, seedTask, seedLink, clearAllProjects via renderer IPC)
- Test isolation: each spec file gets its own Electron instance + temp userData dir
- `clearAllData` only deletes projects; tasks survive with `projectId: null` due to `onDelete: 'set null'`. Works because views exclude unassigned tasks (inner join / projectId filter).
- Navigation helper uses `waitForTimeout(300)` -- fixed delay
- Data seeding goes through renderer `window.api.invoke()` via `page.evaluate()`
- After seeding, navigate away and back to trigger data reload (no reactive subscription to DB)
- HashRouter used (not BrowserRouter) for Electron file:// URL compatibility
- Seeding via page.evaluate uses `any` cast on `window` with eslint-disable comment

### Architecture Boundaries

- Renderer uses `window.api.invoke(channel, payload)` for all IPC -- never accesses DB directly
- Shared types in `src/shared/types/` must not import from `src/main/` (cross-process boundary)
- Drizzle schema in `src/main/db/schema/` is canonical data model
- Priority engine: `src/main/priority/engine.ts` -- pure function `computeFocus(db)` uses innerJoin on projects
- `tasks:list` with `{ archived: false }` returns ALL non-archived tasks including backlog and trigger-blocked
- `computeFocus` uses `innerJoin` on projects, so tasks with null projectId are excluded

### Component Conventions

- Modals: Must use `Modal` component from `src/renderer/src/components/Modal.tsx`
- Toasts: Must use `ToastNotification` + `useToast` from `src/renderer/src/components/Toast.tsx`
- Focus management: First interactive element on modal open, return to trigger on close
- ARIA labels required for icon-only buttons
- ContextCapture modal uses Modal component correctly -- inherits dialog role, focus trap, Escape-to-close

### Naming & Style

- TypeScript strict mode, no `any` without ESLint disable + explanation
- Enums use `as const` object pattern (not TS enums): see `src/shared/types/enums.ts`
- Views are default exports in `src/renderer/src/views/`
- ADRs in `docs/decisions/`, tasks in `docs/tasks/`

### Import Conventions

- Renderer code should prefer `@shared/*` alias over relative `../../../shared/*`
- BoardView and ProjectsView use `@shared/*`; SettingsView, FocusView use relative paths (inconsistency)
- ContextCapture uses relative paths (same as FocusView pattern)
- `@shared` alias configured in `tsconfig.web.json`

### Key Files

- IPC type map: `src/shared/types/ipc.ts` (IpcChannelMap)
- Preload bridge: `src/preload/index.ts`
- DB schema index: `src/main/db/schema/index.ts`
- Color utilities: `src/shared/lib/color-utils.ts`
- ConfigStore: `src/main/config/store.ts` (lazy configPath getter for test isolation)
- App entry (main): `src/main/index.ts` (reads `CHAOS_COORDINATOR_TEST_DATA` env var)
- E2E helpers: `e2e/helpers.ts`, E2E seed: `e2e/seed.ts`, E2E guide: `docs/references/e2e-testing.md`
- ContextCapture component: `src/renderer/src/components/ContextCapture.tsx`
- ColumnHistory IPC handler: `src/main/ipc/columnHistory.ts`
- Links IPC handler: `src/main/ipc/links.ts`
- LinkIcon shared component: `src/renderer/src/components/LinkIcon.tsx`
- react-markdown v10.1.0 used for rendering markdown in FocusView context block
- CLI executor: `src/main/cli/executor.ts`
- URL parser: `src/main/cli/urlParser.ts`
- Intake IPC handler: `src/main/ipc/intake.ts`

### Common Review Issues

- Drizzle with better-sqlite3 is synchronous; `.insert().values()` without `.run()`/`.get()` does NOT execute
- Client-side priority sorting in renderer can diverge from engine logic -- watch for missing filters
- `tasks:list { archived: false }` includes backlog + trigger-blocked tasks that `computeFocus` would exclude
- **handleSaveEdit in BoardView always sends `column` in update payload** -- watch for side effects
- **Timestamp format inconsistency**: `new Date().toISOString()` vs SQLite `datetime('now')`
- **Test fixture completeness**: When adding fields to shared `Task` interface, check ALL test fixtures
- **clearAllData in e2e only deletes projects** -- tasks survive with null projectId. Works because views exclude them, but could cause issues if behavior changes.
- **ContextCapture useEffect deps**: The `[open]` dep array with eslint-disable is intentional -- avoids re-running LLM call when task/column props change after initial open
- **No columnHistory record for archive transitions**: FocusView archive path saves context but skips columnHistory entry
- **Double isTransitioning in defer+confirm**: `handleCaptureConfirm` sets transitioning, then defer branch calls `executeDeferTransition()` which also sets it
- **copiedLinkId timer leak**: `handleCopyLink` uses `setTimeout(1500)` without cleanup -- if modal closes before timer fires, `setCopiedLinkId(null)` runs on unmounted/re-rendered state. Minor but worth noting.
- **Deferred link deletion pattern**: Link removes are batched with Save (not immediate IPC). `removedLinkIds` tracks IDs; `editingLinks` removes from display. Cancel discards both.
- **Azure CLI `--org` flag requires full URL**: `az boards work-item show --org` needs `https://dev.azure.com/OrgName/`, not just the org name. Also `--project` is not a valid flag for `show`. (Fixed in T-007b post-review.)
- **Generic URL auto-populate creates link + calls tasks:update**: For "other" type URLs, intake returns non-null with URL as title, so renderer still calls tasks:update (no-op) and links:create. This is by design for consistency.
- **BoardView.url-populate.test.tsx**: Separate test file for URL auto-population flow -- uses `setupDefaultMocks` helper with `fetchMetadataResult` option, `allInvokes` array for async-safe assertion tracking.
- **E2E url-auto-population.spec.ts**: Tests graceful degradation (gh not installed/authed), uses try/catch for timing-sensitive cancel button.
- **intake.ts test pattern**: Captures IPC handler from `ipcMain.handle` mock, then invokes it directly via `call()` helper. 98.91% coverage.
- **LLM prompt system/user message alignment**: Fixed in T-007b. General pattern to watch: ensure system and user prompts agree on output format (paragraph count, sentence count, etc.).
- **Dual-tracking loading state pattern**: `fetchingTaskIds` (React state for UI) + `activeTaskIdsRef` (ref for cancel-detection) avoids stale-closure race when async fetch resolves after cancel. Good pattern to reference.
