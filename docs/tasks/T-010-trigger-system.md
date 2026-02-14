---
id: T-010
title: 'Trigger System'
status: ready
priority: 4
dependencies: ['T-002']
spec_refs: ['§6.1', '§6.2', '§6.3', '§6.4']
adrs: ['005', '006', '008']
estimated_complexity: XL
tags: [core, business-logic]
created: 2026-02-14
updated: 2026-02-14
---

# T-010: Trigger System

## Context

Triggers are the mechanism that makes Chaos Coordinator proactive — they surface work when external events (agent completion, build results, PR reviews) make it actionable, rather than requiring the user to remember to check.

A trigger is a natural language condition (e.g., "PR #247 CI passes") attached to a task. The system uses an LLM to generate a **self-contained shell script** that checks the condition. The user **reviews and approves** the script before any execution occurs. At poll time, the system simply runs the script and checks the exit code — no LLM is needed.

Exit code convention: 0 = condition met, 1 = not met, 2+ = error. The script's stdout on exit 0 is captured as `firedContext`.

ADR 006 specifies in-process timers (`setInterval`/`setTimeout`) for scheduling. ADR 005 specifies file-based sentinel integration for Claude Code hooks. This is critical-path business logic with 90%+ test coverage required (ADR 008).

## Requirements

1. **Script generation**: When a trigger is created (via intake or Board View edit), use the LLM (T-002) to generate a self-contained shell script from the natural language condition:
   - The script must follow the exit code convention (0 = met, 1 = not met, 2+ = error)
   - The script's stdout on exit 0 should describe what happened (becomes `firedContext`)
   - The generated script is stored in the `checkScript` field; the trigger status is set to `awaiting_approval`

2. **User approval flow**: Before any execution, the user reviews the generated script:
   - Trigger starts in `awaiting_approval` status after generation
   - The user can **approve** (script accepted as-is), **edit** (modify then approve), or **reject** (trigger cancelled)
   - On approve: status transitions to `polling` and the immediate test runs
   - On reject: status transitions to `cancelled`

3. **Immediate test on approval**: When the user approves the script, run it once immediately:
   - Exit 0 → trigger fires right away (condition already met)
   - Exit 1 → trigger enters the polling loop at the default interval
   - Exit 2+ → trigger is marked `failed`; the user is shown the error (stderr from `lastError`) and can edit the script

4. **Polling scheduler**: A background scheduler in the main process that manages all active triggers:
   - Initial poll interval: 5 minutes (300,000ms)
   - On repeated failures (exit 2+): exponential backoff up to 60 minutes (3,600,000ms)
   - On success (exit 0): stop polling, fire the trigger
   - On recovery after failure: reset to 5-minute interval
   - Track `failureCount` and `pollIntervalMs` in the trigger record

5. **Script execution**: Run the check script using `child_process.execFile` (or `exec`):
   - 30-second timeout; kill the process on timeout (treat as exit 2)
   - Capture stdout and stderr separately
   - stderr is stored in `lastError` on exit 2+ for debugging

6. **Trigger firing** (§6.3): When the script exits 0:
   - Update trigger: `status = 'fired'`, `firedAt = now`, `firedContext = stdout`
   - The task becomes actionable (no longer blocked)
   - Priority engine re-evaluates (the task enters the queue at its natural position)
   - If the task is now highest priority, the Focus View should update (see T-012 for notifications)

7. **Manual override** (§6.4):
   - User can manually clear a waiting state, making the task actionable regardless of trigger
   - User can re-arm or edit a trigger condition
   - These actions are available from Board View card edit and Focus View (if task is shown)

8. **Scheduler lifecycle**:
   - On app boot, resume polling only for triggers in `polling` status (not `pending` or `awaiting_approval` — those require user interaction)
   - When a new trigger is created and approved, start polling immediately
   - When a trigger is cancelled or manually cleared, stop its polling
   - When the app quits, all polling stops naturally (in-process timers)

## Existing Code

- **DB schema**: `src/main/db/schema/triggers.ts` — `id`, `taskId`, `nlCondition`, `checkScript`, `status` (includes `awaiting_approval`), `pollIntervalMs`, `failureCount`, `firedContext`, `firedAt`, `lastError`
- **Shared types**: `src/shared/types/enums.ts` — `TriggerStatus` enum (`Pending`, `AwaitingApproval`, `Polling`, `Fired`, `Failed`, `Cancelled`)
- **Shared models**: `src/shared/types/models.ts` — `Trigger` and `InsertTrigger` interfaces (use `checkScript` field)
- **LLM service**: T-002 for one-time script generation only (no LLM at poll time)

## Implementation Notes

- **Module location**: Create `src/main/triggers/` directory with:
  - `generator.ts` — LLM-based generation of shell scripts from NL conditions
  - `scheduler.ts` — manages polling timers for all active triggers
  - `executor.ts` — runs trigger check scripts (`child_process`, timeout, exit code handling)
  - `index.ts` — public API, lifecycle management (start on app boot, etc.)
- **Generation prompt**: "Given this natural language trigger condition: '[nlCondition]', generate a self-contained shell script that checks whether the condition is met. The script must: exit 0 if the condition is met (print a brief description of what happened to stdout), exit 1 if not yet met, exit 2 on error. Available CLI tools: gh, az, git, curl, general shell commands. The script will run periodically until exit 0. Output only the script, no explanation."
- **File-based integration**: For triggers that check external tool completion (e.g., Claude Code agent sessions), generate scripts that check for sentinel files at `~/.chaos-coordinator/triggers/trigger-<ID>.signal`. External tools create these files to signal events (see ADR 005).
- **Timer management**: Use `setTimeout` (not `setInterval`) for easier backoff management. Each trigger has its own timer. On each check, schedule the next one based on the result.
- **Concurrency**: Trigger checks should not overlap for the same trigger. Use a `checking` flag or lock per trigger.
- **CLI executor**: Use `child_process.exec` with a 30-second timeout. Run scripts via `bash -c` or write to a temp file and execute.
- **IPC handlers**: Add `triggers:create`, `triggers:update`, `triggers:cancel`, `triggers:manualFire`, `triggers:approve`, `triggers:reject` IPC channels.
- **App lifecycle**: Register the scheduler in `src/main/index.ts` — start on `app.whenReady()`, stop on `app.on('before-quit')`.

## Testing Requirements

**Coverage target: 90%+ line coverage** (critical business logic per ADR 008).

Test in the `node` Vitest project.

### Generator tests:

1. **GitHub CI check**: NL "CI build on PR #247 passes" → generates script with `gh pr checks` and exit code logic.
2. **PR review**: NL "PR #52 gets approved" → generates script with `gh pr view --json reviewDecision`.
3. **Timer trigger**: NL "30 minutes have passed" → generates a time-based check (compares current time to a stored start time).
4. **Invalid condition**: Gracefully handle unparseable conditions (LLM returns error or empty script).
5. **File-based trigger**: NL "Claude Code agent finishes" → generates script checking sentinel file.
6. **Exit code convention**: Verify generated scripts use exit 0/1/2 convention.

### Approval flow tests:

7. **Approve transitions to polling**: Approving a trigger in `awaiting_approval` runs the immediate test and transitions to `polling` (if exit 1).
8. **Approve with immediate fire**: If immediate test exits 0, trigger fires directly without entering polling.
9. **Approve with immediate error**: If immediate test exits 2+, trigger is marked `failed` with `lastError` populated.
10. **Edit and approve**: User edits the script, then approves — the edited script is stored.
11. **Reject cancels trigger**: Rejecting a trigger transitions to `cancelled`.

### Scheduler tests:

12. **Initial poll**: New approved trigger starts polling at 5-minute interval.
13. **Backoff on failure**: After exit 2+ failures, interval increases up to 60 minutes.
14. **Reset on recovery**: After backoff, exit 1 (not met but no error) resets interval.
15. **Stop on fire**: When exit 0, polling stops.
16. **Stop on cancel**: When trigger cancelled, polling stops.
17. **App boot**: Only `polling` triggers resume on startup (not `pending` or `awaiting_approval`).
18. **Concurrent check prevention**: Same trigger doesn't get two simultaneous checks.

### Executor tests:

19. **Exit 0 (condition met)**: Script exits 0 → returns `{ conditionMet: true, stdout: '...' }`.
20. **Exit 1 (not met)**: Script exits 1 → returns `{ conditionMet: false }`.
21. **Exit 2+ (error)**: Script exits 2 → returns `{ error: true, stderr: '...' }`, increments failure count.
22. **Timeout**: Script exceeds 30s → killed, treated as exit 2.
23. **Stdout capture**: Verify stdout is captured correctly for `firedContext`.
24. **Stderr capture**: Verify stderr is captured correctly for `lastError`.

### Integration tests:

25. **Full cycle**: Create trigger → generate script → approve → immediate test (exit 1) → poll → fire (exit 0) → task becomes actionable.
26. **Manual override**: Clear waiting state → task immediately actionable, trigger cancelled.
27. **Sentinel file flow**: Create trigger with file-based check → write sentinel file → next poll exits 0 → trigger fires.

## Documentation

- Update `docs/ARCHITECTURE.md` trigger scheduler section with the full lifecycle (already done during this redesign).
- Document the polling/backoff algorithm.
- Document the file-based integration pattern in ADR 005.

## Verification

1. Run `npm run test` — trigger system tests pass with 90%+ coverage on `src/main/triggers/`.
2. Run `npm run dev`:
   - Create a task with a trigger condition (e.g., "PR #1 in org/repo has at least 1 approval").
   - Verify the system generates a shell script and presents it for approval.
   - Approve the script — verify the immediate test runs.
   - Verify polling starts (check logs or add a debug indicator).
   - Manually satisfy the condition — verify the trigger fires and the task becomes actionable.
   - Test manual override — clear the waiting state from the Board View card.
   - Test reject — verify the trigger is cancelled and no polling occurs.
