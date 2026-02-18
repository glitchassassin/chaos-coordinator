# ADR 015: Main Process Logging Strategy

**Status:** Accepted
**Date:** 2026-02-18

## Context

Before T-015, the main process had no structured logging. Errors and warnings were written directly to `console.error` / `console.warn`, which surfaces them in Electron's devtools console but nowhere else. This had two problems:

1. **No in-app visibility.** The Debug tab (T-015) provides a real-time log stream, but raw `console.*` calls bypass it entirely — they never reach the `DebugEventBus` ring buffer and are invisible to the renderer.

2. **No structured metadata.** `console.*` calls are plain strings. There's no way to filter by source (LLM vs. config vs. CLI), by severity, or to attach structured data for programmatic inspection.

## Decision

All main-process logging goes through `createLogger(source)` from `src/main/debug/logger.ts`.

```ts
import { createLogger } from '../debug'

const logger = createLogger('llm') // source: 'llm' | 'ipc' | 'db' | 'cli' | 'config' | 'app'

logger.debug('Prompt tokens', { tokens: 1234 })
logger.info('Model response received')
logger.warn('Rate limit approaching')
logger.error('Generation failed', error)
```

### Behavior by level

| Level   | Debug bus | Console         |
| ------- | --------- | --------------- |
| `debug` | ✓         | —               |
| `info`  | ✓         | —               |
| `warn`  | ✓         | `console.warn`  |
| `error` | ✓         | `console.error` |

`warn` and `error` write to both the debug bus and the real console. This ensures they still surface in devtools and in production Electron logs (where the debug tab may not be open), while also appearing in the in-app log stream.

`debug` and `info` only go to the debug bus. They would be too noisy for devtools and aren't important enough to surface outside the Debug tab.

### Source taxonomy

`LogSource` is a closed union defined in `src/shared/types/debug.ts`:

```ts
type LogSource = 'llm' | 'ipc' | 'db' | 'cli' | 'config' | 'app'
```

Pick the source that best describes the subsystem emitting the log. Use `'app'` for top-level wiring code in `src/main/index.ts`.

### Do not use `console.*` directly in main-process code

Raw `console.error` / `console.warn` calls in the main process bypass the debug bus and won't appear in the Debug tab. Exceptions:

- **Inside `createLogger` itself** — the logger's `warn`/`error` methods call `console.warn`/`console.error` intentionally.
- **Renderer code** — the debug bus is main-process only. Renderer code may use `console.*` freely.
- **Test files** — test code may spy on `console.*` directly.

### Pending migration

The following files still use raw `console.*` and should be migrated when touched:

- `src/main/llm/service.ts` — three `console.error` calls in error handlers
- `src/main/config/store.ts` — two `console.warn` calls + one `console.error`
- `src/main/ipc/projects.ts` — one `console.error` in catch block

## Alternatives Considered

### External logging library (winston, pino, electron-log)

**Rejected.** Adds a dependency for a single-user desktop app. The debug bus already provides structured, in-process event streaming. External libraries are primarily valuable for file-based or remote log aggregation, which this app doesn't need.

### Keep `console.*` everywhere

**Rejected.** Invisible to the Debug tab. No structured metadata. Inconsistent with the debug infrastructure built in T-015.

### Single global logger (no source tagging)

**Rejected.** Source tagging is the primary filter axis in the Debug tab's log stream panel. Without it, filtering to "just LLM logs" or "just config logs" isn't possible.

## Consequences

### Positive

- All `warn` / `error` events from main-process code are visible in the Debug tab's log stream, filterable by source and level.
- Structured `data` field allows attaching error objects or contextual metadata that renders expandable in the UI.
- `warn`/`error` still reach `console.*` so nothing is lost for devtools or production diagnostics.

### Negative

- Requires a minor convention discipline: new main-process code must use `createLogger` rather than `console.*`. The existing unconverted call sites are a temporary gap until they're touched in future work.

## Related Decisions

- **ADR 013:** Auto-task pipeline (T-015) — introduced the debug infrastructure this logger is part of
- **ADR 008:** Code quality standards — `strict` mode and review criteria apply to logger usage
