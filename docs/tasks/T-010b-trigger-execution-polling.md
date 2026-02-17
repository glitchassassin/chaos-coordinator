---
id: T-010b
title: 'Trigger Execution, Polling + Firing'
status: ready
priority: 4
dependencies: ['T-002', 'T-010a']
spec_refs: ['§6.2', '§6.3', '§6.4']
adrs: ['006', '008']
estimated_complexity: L
tags: [core, business-logic]
created: 2026-02-16
updated: 2026-02-16
---

# T-010b: Trigger Execution, Polling + Firing

## Context

This task builds the runtime engine for triggers — executing the approved shell scripts, managing the polling schedule with backoff, handling trigger firing, and integrating with the app lifecycle. T-010a provides the script generation and approval flow; this task makes the approved scripts actually run.

Split from T-010 (Trigger System). Requires T-010a (generation + approval).

This is critical-path business logic with 90%+ test coverage required (ADR 008).

ADR 006 specifies in-process timers (`setTimeout`) for scheduling.

## Requirements

1. **Script execution**: Run check scripts using `child_process.exec`:
   - 30-second timeout; kill on timeout (treat as exit 2)
   - Capture stdout and stderr separately
   - Exit 0 = condition met, 1 = not met, 2+ = error

2. **Immediate test on approval**: When T-010a approves a trigger, run the script once immediately:
   - Exit 0 -> trigger fires right away (condition already met)
   - Exit 1 -> trigger enters the polling loop
   - Exit 2+ -> trigger is marked `failed` with `lastError` populated; user can edit the script

3. **Polling scheduler**: A background scheduler in the main process managing all active triggers:
   - Initial poll interval: 5 minutes (300,000ms)
   - On repeated failures (exit 2+): exponential backoff up to 60 minutes (3,600,000ms)
   - On success (exit 0): stop polling, fire the trigger
   - On recovery after failure (exit 1): reset to 5-minute interval
   - Track `failureCount` and `pollIntervalMs` in the trigger record

4. **Trigger firing**: When the script exits 0:
   - Update trigger: `status = 'fired'`, `firedAt = now`, `firedContext = stdout`
   - The task becomes actionable (no longer blocked by the trigger)
   - Priority engine re-evaluates (the task enters the queue at its natural position)

5. **Manual override**:
   - User can manually clear a waiting state, making the task actionable regardless of trigger
   - User can re-arm a trigger (reset to polling) or edit the trigger condition (re-generate script via T-010a)
   - Available from Board View card edit

6. **Scheduler lifecycle**:
   - On app boot, resume polling only for triggers in `polling` status
   - When a trigger is approved, start polling (after the immediate test)
   - When a trigger is cancelled or manually cleared, stop its polling
   - On app quit, all polling stops naturally (in-process timers)

7. **Concurrent check prevention**: Same trigger must not get two simultaneous checks. Use a `checking` flag per trigger.

## Existing Code

- **Trigger module**: T-010a creates `src/main/triggers/` with `generator.ts` and `index.ts`
- **DB schema**: `src/main/db/schema/triggers.ts` — all trigger fields including `pollIntervalMs`, `failureCount`, `lastError`
- **Shared types**: `TriggerStatus` enum, `Trigger` interface
- **App lifecycle**: `src/main/index.ts` — `app.whenReady()`, `app.on('before-quit')`

## Implementation Notes

- **Module location**: Add to `src/main/triggers/`:
  - `executor.ts` — runs a trigger's check script, returns `{ conditionMet, stdout, stderr, exitCode }`
  - `scheduler.ts` — manages polling timers for all active triggers, handles backoff logic
  - Update `index.ts` — lifecycle management (start on boot, stop on quit), manual override handlers
- **Timer management**: Use `setTimeout` (not `setInterval`) for easier backoff. Each trigger tracks its own timer ID. On each check, schedule the next one based on the result.
- **Backoff formula**: `Math.min(300_000 * 2 ** failureCount, 3_600_000)` for exponential backoff capped at 60 minutes.
- **IPC handlers**: Add `triggers:manualClear`, `triggers:rearm`, `triggers:update` (for editing). Hook into T-010a's `triggers:approve` to trigger the immediate test.
- **App lifecycle**: Register the scheduler's `start()` in `app.whenReady()` and `stop()` in `app.on('before-quit')`. `start()` queries for all triggers in `polling` status and begins their timers.
- **CLI executor**: Run scripts via `bash -c` with a 30-second timeout. Use `child_process.exec` for shell interpretation (scripts may use pipes, redirects, etc.).

## Testing Requirements

**Coverage target: 90%+ line coverage.**

Test in the `node` Vitest project.

### Executor tests:

1. **Exit 0 (condition met)**: Script exits 0 -> returns `{ conditionMet: true, stdout: '...' }`.
2. **Exit 1 (not met)**: Script exits 1 -> returns `{ conditionMet: false }`.
3. **Exit 2+ (error)**: Script exits 2 -> returns `{ error: true, stderr: '...' }`.
4. **Timeout**: Script exceeds 30s -> killed, treated as exit 2.
5. **Stdout capture**: Verify stdout captured correctly for `firedContext`.
6. **Stderr capture**: Verify stderr captured correctly for `lastError`.

### Scheduler tests:

7. **Initial poll**: New approved trigger starts polling at 5-minute interval.
8. **Backoff on failure**: After exit 2+ failures, interval increases up to 60 minutes.
9. **Reset on recovery**: After backoff, exit 1 resets interval to 5 minutes.
10. **Stop on fire**: When exit 0, polling stops and trigger status is `fired`.
11. **Stop on cancel**: When trigger cancelled, polling stops.
12. **App boot**: Only `polling` triggers resume on startup.
13. **Concurrent check prevention**: Same trigger doesn't get two simultaneous checks.

### Immediate test tests:

14. **Immediate fire**: Approve trigger where condition already met (exit 0) -> trigger fires immediately, no polling.
15. **Immediate not-met**: Exit 1 on immediate test -> enters polling loop.
16. **Immediate error**: Exit 2+ on immediate test -> marked `failed` with `lastError`.

### Integration tests:

17. **Full cycle**: Create trigger -> approve -> immediate test (exit 1) -> poll -> fire (exit 0) -> task becomes actionable.
18. **Manual override**: Clear waiting state -> task immediately actionable, trigger stopped.
19. **Sentinel file flow**: Trigger with file-based check -> write sentinel file -> next poll exits 0 -> trigger fires.

## E2E Testing

At least one Playwright e2e test covering the core user flow. Uses the e2e helpers and patterns established in T-014.

Trigger execution involves background timers and shell scripts, which are hard to test end-to-end without real waiting. Focus on the user-visible outcomes and manual override.

1. **Manual override clears waiting state**: Seed a task with a trigger in `polling` status (task appears dimmed/waiting on Board View) → open the card edit → click "Clear waiting" → verify the task becomes actionable (full opacity, no waiting indicator) → navigate to Focus View → verify the task can appear as the focus task.

## Verification

1. Run `npm run test` — execution and scheduling tests pass with 90%+ coverage on `src/main/triggers/executor.ts` and `src/main/triggers/scheduler.ts`.
2. Run `npx playwright test e2e/trigger-execution.spec.ts` — e2e tests pass.
3. Run `npm run dev`:
   - Approve a trigger — verify the immediate test runs.
   - If condition not met, verify polling starts (check logs or add debug indicator).
   - Manually satisfy the condition — verify the trigger fires and the task becomes actionable in Focus View.
   - Test manual override — clear the waiting state from Board View.
   - Test a failing script — verify backoff behavior (interval increases).
   - Quit and relaunch the app — verify polling triggers resume.
