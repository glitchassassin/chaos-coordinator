---
id: T-010
title: 'Trigger System'
status: ready
priority: 4
dependencies: ['T-002', 'T-009']
spec_refs: ['§6.1', '§6.2', '§6.3', '§6.4']
adrs: ['006', '008']
estimated_complexity: XL
tags: [core, business-logic]
created: 2026-02-14
updated: 2026-02-14
---

# T-010: Trigger System

## Context

Triggers are the mechanism that makes Chaos Coordinator proactive — they surface work when external events (agent completion, build results, PR reviews) make it actionable, rather than requiring the user to remember to check.

A trigger is a natural language condition (e.g., "PR #247 CI passes") attached to a task. A background agent interprets the condition, translates it into a CLI check, and polls periodically. When the condition is met, the task becomes actionable and re-enters the priority queue.

ADR 006 specifies in-process timers (`setInterval`/`setTimeout`) for scheduling. This is critical-path business logic with 90%+ test coverage required (ADR 008).

## Requirements

1. **Trigger interpretation**: When a trigger is created (via intake or Board View edit), use the LLM (T-002) to interpret the natural language condition and produce:
   - A CLI command to check the condition (must be read-only, verified by T-009)
   - A description of what "success" looks like in the command output
   - The `interpretedCheck` field is stored in the trigger record

2. **Polling scheduler**: A background scheduler in the main process that manages all active triggers:
   - Initial poll interval: 5 minutes (300,000ms)
   - On repeated failures: exponential backoff up to 60 minutes (3,600,000ms)
   - On success (condition met): stop polling, fire the trigger
   - On recovery after failure: reset to 5-minute interval
   - Track `failureCount` and `pollIntervalMs` in the trigger record

3. **Trigger check execution**:
   - Execute the interpreted CLI command using the command executor
   - Verify the command is classified as read-only (T-009) before execution
   - Parse the output to determine if the condition is met (may need LLM to interpret output against the "success" description)

4. **Trigger firing** (§6.3): When a condition is met:
   - Update trigger: `status = 'fired'`, `firedAt = now`, `firedContext = <description of what happened>`
   - The task becomes actionable (no longer blocked)
   - Priority engine re-evaluates (the task enters the queue at its natural position)
   - If the task is now highest priority, the Focus View should update (see T-012 for notifications)

5. **Manual override** (§6.4):
   - User can manually clear a waiting state, making the task actionable regardless of trigger
   - User can re-arm or edit a trigger condition
   - These actions are available from Board View card edit and Focus View (if task is shown)

6. **Scheduler lifecycle**:
   - Start polling for all `pending`/`polling` triggers on app launch
   - When a new trigger is created, start polling immediately
   - When a trigger is cancelled or manually cleared, stop its polling
   - When the app quits, all polling stops naturally (in-process timers)

## Existing Code

- **DB schema**: `src/main/db/schema/triggers.ts` — `id`, `taskId`, `nlCondition`, `interpretedCheck`, `status`, `pollIntervalMs`, `failureCount`, `firedContext`, `firedAt`
- **Shared types**: `src/shared/types/enums.ts` — `TriggerStatus` enum (`Pending`, `Polling`, `Fired`, `Failed`, `Cancelled`)
- **LLM service**: T-002 for interpreting conditions and checking output
- **Command safety**: T-009 for verifying commands are read-only

## Implementation Notes

- **Module location**: Create `src/main/triggers/` directory with:
  - `interpreter.ts` — LLM-based interpretation of NL conditions into CLI commands
  - `scheduler.ts` — manages polling timers for all active triggers
  - `executor.ts` — runs trigger checks (CLI command + output interpretation)
  - `index.ts` — public API, lifecycle management (start on app boot, etc.)
- **Interpretation prompt**: "Given this natural language trigger condition: '[nlCondition]', generate: (1) a read-only CLI command to check this condition, (2) a description of what the output looks like when the condition is met. The command will be run periodically. Available CLI tools: gh, az, git, curl, general shell commands."
- **Output interpretation**: After running the CLI command, use the LLM to compare the output against the "success" description. Use structured output: `{ conditionMet: boolean, explanation: string }`.
- **Timer management**: Use `setTimeout` (not `setInterval`) for easier backoff management. Each trigger has its own timer. On each check, schedule the next one based on the result.
- **Concurrency**: Trigger checks should not overlap for the same trigger. Use a `checking` flag or lock per trigger.
- **CLI executor**: Reuse or extend the CLI executor from T-007 (`src/main/cli/executor.ts`). Add a timeout (e.g., 30 seconds) to prevent hung commands.
- **IPC handlers**: Add `triggers:create`, `triggers:update`, `triggers:cancel`, `triggers:manualFire` IPC channels.
- **App lifecycle**: Register the scheduler in `src/main/index.ts` — start on `app.whenReady()`, stop on `app.on('before-quit')`.

## Testing Requirements

**Coverage target: 90%+ line coverage** (critical business logic per ADR 008).

Test in the `node` Vitest project.

### Interpreter tests:

1. **GitHub CI check**: NL "CI build on PR #247 passes" → generates `gh pr checks 247 --repo ...` command.
2. **PR review**: NL "PR #52 gets approved" → generates `gh pr view 52 --json reviewDecision`.
3. **Timer trigger**: NL "30 minutes have passed" → generates a time-based check (no CLI needed).
4. **Invalid condition**: Gracefully handle unparseable conditions.
5. **Command safety enforced**: Verify interpreted command passes read-only classification.

### Scheduler tests:

6. **Initial poll**: New trigger starts polling at 5-minute interval.
7. **Backoff on failure**: After failures, interval increases up to 60 minutes.
8. **Reset on recovery**: After backoff, successful check resets interval.
9. **Stop on fire**: When condition met, polling stops.
10. **Stop on cancel**: When trigger cancelled, polling stops.
11. **App boot**: Existing `pending`/`polling` triggers resume polling on startup.
12. **Concurrent check prevention**: Same trigger doesn't get two simultaneous checks.

### Executor tests:

13. **Successful check**: Mock CLI output that matches condition → returns `conditionMet: true`.
14. **Failed check**: Mock CLI output that doesn't match → returns `conditionMet: false`.
15. **CLI error**: Mock command failure → increments failure count, triggers backoff.
16. **Timeout**: Mock slow command → handled gracefully.

### Integration tests:

17. **Full cycle**: Create trigger → interpret → poll → fire → task becomes actionable.
18. **Manual override**: Clear waiting state → task immediately actionable, trigger cancelled.

## Documentation

- Add a section to `docs/ARCHITECTURE.md` describing the trigger system architecture: interpretation, scheduling, execution, and firing.
- Document the polling/backoff algorithm.

## Verification

1. Run `npm run test` — trigger system tests pass with 90%+ coverage on `src/main/triggers/`.
2. Run `npm run dev`:
   - Create a task with a trigger condition (e.g., "PR #1 in org/repo has at least 1 approval").
   - Verify the trigger is interpreted (check the `interpretedCheck` field in the DB).
   - Verify polling starts (check logs or add a debug indicator).
   - Manually satisfy the condition — verify the trigger fires and the task becomes actionable.
   - Test manual override — clear the waiting state from the Board View card.
