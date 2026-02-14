# ADR 009: Automatic Native Module Rebuild for Tests

**Status:** Accepted
**Date:** 2026-02-13

## Context

`better-sqlite3` is a native Node.js module that must be compiled against a specific ABI. Electron uses a different ABI than Node.js, so `electron-builder` recompiles it during `npm run build`. After that, `npm run test` (which runs under Node.js via Vitest) fails with a `NODE_MODULE_VERSION` mismatch because the binary was built for Electron.

This creates an ordering dependency: `build` then `test` breaks, but `test` then `build` works. Developers (and CI) shouldn't have to think about this.

## Decision

### Automatic rebuilds via npm lifecycle scripts

- **`pretest`**: `npm rebuild better-sqlite3` — recompiles for Node.js before Vitest runs.
- **`pretest:e2e`**: `npx electron-rebuild -f -w better-sqlite3` — recompiles for Electron before Playwright E2E tests run.

npm runs `pre<script>` hooks automatically, so `npm run test` and `npm run test:e2e` always work regardless of prior state.

### Shared mock DB helper

A reusable `createMockDb()` factory (`src/main/__tests__/helpers/mock-db.ts`) provides an in-memory SQLite database with all schema tables and a properly-typed Drizzle instance. Future unit tests for IPC handlers and services can mock `getDb()` without each test file managing its own table creation.

### Alternatives considered

- **Vitest `vi.mock` to stub `better-sqlite3` entirely:** Would prevent testing real SQL behavior, defeating the purpose of schema/integration tests.
- **Docker-based test runner:** Overkill for a single-user desktop app. Adds CI complexity.
- **Separate `test:fix` script the developer runs manually:** Violates the principle that `npm run test` should just work.

## Consequences

- **`npm run test` always works** regardless of whether `build` ran first. Small (~1s) overhead from the rebuild on each run.
- **`npm run test:e2e` always works** regardless of whether unit tests ran first.
- **New test files** can use `createMockDb()` instead of duplicating table-creation SQL.
- **Schema changes** require updating the SQL in `mock-db.ts` alongside the Drizzle schema files. This is acceptable since schema changes already require updating migrations.
