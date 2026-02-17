---
id: T-010a
title: 'Trigger Generation + Approval Flow'
status: ready
priority: 4
dependencies: ['T-002']
spec_refs: ['§6.1', '§6.2']
adrs: ['005', '008']
estimated_complexity: M
tags: [core, business-logic, llm]
created: 2026-02-16
updated: 2026-02-16
---

# T-010a: Trigger Generation + Approval Flow

## Context

Triggers make tasks proactive — a natural language condition like "PR #247 CI passes" is converted to a shell script that can be polled. This task covers the generation of those scripts via LLM and the user approval flow. Actual execution and polling are handled by T-010b.

Split from T-010 (Trigger System). See T-010b for execution, polling, and firing.

This is critical-path business logic with 90%+ test coverage required (ADR 008).

## Requirements

1. **Script generation**: When a trigger is created (via the intake form or Board View card edit), use the LLM (T-002) to generate a self-contained shell script from the natural language condition:
   - The script must follow the exit code convention: 0 = condition met, 1 = not met, 2+ = error
   - Stdout on exit 0 describes what happened (becomes `firedContext`)
   - The generated script is stored in the `checkScript` field
   - Trigger status is set to `awaiting_approval`

2. **User approval UI**: A dialog/modal showing the generated script for review:
   - **Approve**: Accept the script as-is -> status transitions to `approved` (T-010b handles the immediate test and transition to `polling`)
   - **Edit**: Modify the script in an editor, then approve
   - **Reject**: Cancel the trigger -> status transitions to `cancelled`

3. **Script display**: Show the script in a code block with syntax highlighting (or at minimum a monospace font). The user needs to be able to read and understand what will be executed.

4. **Trigger CRUD**: IPC handlers for:
   - `triggers:create` — accepts `taskId` + `nlCondition`, calls LLM to generate script, returns trigger in `awaiting_approval` status
   - `triggers:approve` — accepts `triggerId` + optional edited `checkScript`, transitions status
   - `triggers:reject` — accepts `triggerId`, transitions to `cancelled`
   - `triggers:get` — fetch a trigger by ID
   - `triggers:listByTask` — fetch triggers for a task

5. **Board View integration**: Tasks with triggers show the trigger status on their card. Tasks in `awaiting_approval` show a badge prompting the user to review the script.

6. **File-based sentinel support**: For triggers that check tool completion (e.g., Claude Code agent sessions), generate scripts that check for sentinel files at `~/.chaos-coordinator/triggers/trigger-<ID>.signal` (ADR 005).

## Existing Code

- **DB schema**: `src/main/db/schema/triggers.ts` — `id`, `taskId`, `nlCondition`, `checkScript`, `status`, `pollIntervalMs`, `failureCount`, `firedContext`, `firedAt`, `lastError`
- **Shared types**: `src/shared/types/enums.ts` — `TriggerStatus` enum (`Pending`, `AwaitingApproval`, `Polling`, `Fired`, `Failed`, `Cancelled`)
- **Shared models**: `src/shared/types/models.ts` — `Trigger` and `InsertTrigger` interfaces
- **LLM service**: T-002 for script generation
- **Modal component**: `src/renderer/src/components/Modal.tsx`

## Implementation Notes

- **Module location**: Create `src/main/triggers/` directory with:
  - `generator.ts` — LLM-based generation of shell scripts from NL conditions
  - `index.ts` — public API (create, approve, reject, get, list)
- **Generation prompt**: "Given this natural language trigger condition: '[nlCondition]', generate a self-contained shell script that checks whether the condition is met. The script must: exit 0 if the condition is met (print a brief description of what happened to stdout), exit 1 if not yet met, exit 2 on error. Available CLI tools: gh, az, git, curl, general shell commands. The script will run periodically until exit 0. Output only the script, no explanation."
- **Approval component**: Create `src/renderer/src/components/TriggerApproval.tsx` — a modal with the script in a `<pre>` or code editor, plus Approve / Edit / Reject buttons.
- **IPC registration**: Add handlers in the main process IPC setup. The `triggers:create` handler should call the generator, insert the DB record, and return the trigger.
- **Board View card enhancement**: Add a trigger status indicator to task cards. If `awaiting_approval`, show a clickable badge that opens the approval modal.

## Testing Requirements

**Coverage target: 90%+ line coverage.**

### Generator tests (node Vitest project):

1. **GitHub CI check**: NL "CI build on PR #247 passes" -> generates script with `gh pr checks` and exit code logic.
2. **PR review**: NL "PR #52 gets approved" -> generates script with `gh pr view --json reviewDecision`.
3. **Timer trigger**: NL "30 minutes have passed" -> generates a time-based check.
4. **Invalid condition**: Gracefully handle unparseable conditions (LLM returns error or empty script).
5. **File-based trigger**: NL "Claude Code agent finishes" -> generates script checking sentinel file.
6. **Exit code convention**: Verify generated scripts use exit 0/1/2 convention.

### Approval flow tests (node Vitest project):

7. **Create sets awaiting_approval**: Creating a trigger generates a script and sets status to `awaiting_approval`.
8. **Approve transitions status**: Approving a trigger transitions from `awaiting_approval`.
9. **Edit and approve**: Edited script is stored on approve.
10. **Reject cancels**: Rejecting sets status to `cancelled`.

### Renderer tests (jsdom Vitest project):

11. **Approval modal renders**: Verify script displays in code block with Approve/Edit/Reject buttons.
12. **Approve calls IPC**: Click Approve -> verify `triggers:approve` called.
13. **Reject calls IPC**: Click Reject -> verify `triggers:reject` called.
14. **Board View trigger badge**: Task with `awaiting_approval` trigger shows badge.

## E2E Testing

At least one Playwright e2e test covering the core user flow. Uses the e2e helpers and patterns established in T-014.

Since trigger generation uses LLM calls, the e2e test should seed a trigger already in `awaiting_approval` status with a pre-generated script, then test the approval UI.

1. **Approve trigger script**: Seed a task with a trigger in `awaiting_approval` status (including a `checkScript`) → navigate to Board View → verify the task card shows an approval badge → click the badge → verify the approval modal shows the script → click Approve → verify the trigger status updates on the card.
2. **Reject trigger script**: Same setup → open approval modal → click Reject → verify the trigger status changes to cancelled.

## Verification

1. Run `npm run test` — trigger generation and approval tests pass with 90%+ coverage on `src/main/triggers/generator.ts`.
2. Run `npx playwright test e2e/trigger-approval.spec.ts` — e2e tests pass.
3. Run `npm run dev`:
   - Create a task with a trigger condition via the intake form.
   - Verify the system generates a shell script and presents it for approval.
   - Read the script — verify it looks reasonable for the condition.
   - Approve it — verify status changes (card updates on board).
   - Create another trigger and reject it — verify it's cancelled.
   - Edit a script before approving — verify the edited version is stored.
