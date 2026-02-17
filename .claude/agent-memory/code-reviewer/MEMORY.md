# Code Reviewer Agent Memory

## Project Patterns

### Testing Patterns

- Most view tests use `Object.defineProperty(window, 'api', {...})` for mocking `window.api`
- FocusView test uses `vi.stubGlobal('api', {...})` -- inconsistent but both work
- Existing test files: `App.test.tsx`, `BoardView.test.tsx`, `ProjectsView.test.tsx`, `SettingsView.test.tsx`, `FocusView.test.tsx`
- Tests use `@testing-library/react` + `userEvent` + `vitest`
- Coverage: 80% overall, 90%+ for critical business logic (priority engine, trigger system, command safety)
- Coverage thresholds enforced globally (80%) in `vitest.config.ts` lines 59-64, not per-file

### Architecture Boundaries

- Renderer uses `window.api.invoke(channel, payload)` for all IPC -- never accesses DB directly
- Shared types in `src/shared/types/` must not import from `src/main/` (cross-process boundary)
- Drizzle schema in `src/main/db/schema/` is canonical data model
- Priority engine: `src/main/priority/engine.ts` -- pure function `computeFocus(db)`
- `tasks:list` with `{ archived: false }` returns ALL non-archived tasks including backlog and trigger-blocked

### Component Conventions

- Modals: Must use `Modal` component from `src/renderer/src/components/Modal.tsx`
- Toasts: Must use `ToastNotification` + `useToast` from `src/renderer/src/components/Toast.tsx`
- Focus management: First interactive element on modal open, return to trigger on close
- ARIA labels required for icon-only buttons

### Naming & Style

- TypeScript strict mode, no `any` without ESLint disable + explanation
- Enums use `as const` object pattern (not TS enums): see `src/shared/types/enums.ts`
- Views are default exports in `src/renderer/src/views/`
- ADRs in `docs/decisions/`, tasks in `docs/tasks/`

### Import Conventions

- Renderer code should prefer `@shared/*` alias over relative `../../../shared/*`
- BoardView and ProjectsView use `@shared/*`; SettingsView, FocusView use relative paths (inconsistency)
- `@shared` alias configured in `tsconfig.web.json`

### E2E Testing Patterns

- Playwright config: `playwright.config.ts` (testDir: `./e2e`, 30s timeout)
- Existing e2e: `e2e/app.spec.ts` (smoke test), `e2e/helpers.ts` (launchApp)
- T-014 establishes e2e infrastructure: helpers, seeding via `app.evaluate()`, navigation helpers
- E2E sections in task files follow pattern: intro sentence + numbered scenarios + verification step
- LLM-dependent tasks address mocking: seed pre-computed data, test degradation paths, or mock IPC
- Backend-only tasks (T-009) delegate e2e to consuming UI tasks
- DnD testing in Playwright may need custom helpers for `@dnd-kit` compatibility

### Key Files

- IPC type map: `src/shared/types/ipc.ts` (IpcChannelMap)
- Preload bridge: `src/preload/index.ts`
- DB schema index: `src/main/db/schema/index.ts`
- Color utilities: `src/shared/lib/color-utils.ts` (hexToRgb, textColorOn, relativeLuminance, contrastRatio, ciede2000)
- E2E helpers: `e2e/helpers.ts`, E2E smoke test: `e2e/app.spec.ts`

### Common Review Issues

- Drizzle with better-sqlite3 is synchronous; `.insert().values()` without `.run()`/`.get()` does NOT execute
- Client-side priority sorting in renderer can diverge from engine logic -- watch for missing filters
- `tasks:list { archived: false }` includes backlog + trigger-blocked tasks that `computeFocus` would exclude
- **handleSaveEdit in BoardView always sends `column` in update payload** -- any IPC handler logic that checks `data.column !== undefined` will trigger on every edit, not just column changes. Watch for this pattern.
- **Timestamp format inconsistency**: `new Date().toISOString()` produces `2024-01-15T10:30:00.000Z`, SQLite `datetime('now')` produces `2024-01-15 10:30:00`. Both parse correctly via `new Date()` but look different in the DB.
- **Test fixture completeness**: When adding fields to shared `Task` interface, check ALL test fixtures including inline ones inside individual test cases, not just top-level fixtures. TypeScript may not catch missing fields in loosely-typed contexts (array spreads, etc.).
