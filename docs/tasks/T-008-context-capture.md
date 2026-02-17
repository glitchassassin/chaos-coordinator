---
id: T-008
title: 'Context Capture (Shelving)'
status: ready
priority: 3
dependencies: ['T-002']
spec_refs: ['§5.1', '§5.2']
adrs: []
estimated_complexity: M
tags: [workflow, llm]
created: 2026-02-14
updated: 2026-02-14
---

# T-008: Context Capture (Shelving)

## Context

Context capture is what makes Chaos Coordinator more than a kanban board. When a user leaves a task — whether completing a phase, deferring, or being preempted by a higher-priority triggered task — the system captures where they left off so they can resume in seconds, not minutes.

The system uses LLM-generated summaries, informed by the task's current state and linked resource updates, to pre-populate the context block. The user confirms with one click or edits if needed. Target interaction time: under 15 seconds.

## Requirements

1. **Phase transition capture** (task moves between columns): Always prompt for context capture. Show the LLM-generated context summary for review before the task moves.

2. **Defer capture** (user switches tasks without changing column): Prompt for context capture, but allow skipping. If skipped, the previous context block is retained.

3. **Preempt capture** (higher-priority task takes over): Prompt for a quick capture, but make it frictionless. Default to the auto-generated summary with a "confirm or edit later" option — the user is being pulled away and doesn't want a speed bump.

4. **LLM context generation**: Generate the context summary using:
   - The task's current context block (what was known before)
   - The task's current column and the transition happening
   - Trigger info (if applicable)
   - Any linked resource updates since last capture (fetch current state via CLI and diff against stored metadata, if feasible)
   - The nature of the transition (completing, deferring, being preempted)

5. **Context block stored**: On confirmation, update the task's `contextBlock` field and create a `columnHistory` entry with the `contextSnapshot`.

6. **Inline editing**: The context capture UI should show the generated text in an editable text area. One-click confirm, or edit and then confirm.

## Existing Code

- **DB schema**: `tasks.contextBlock`, `columnHistory.contextSnapshot`
- **IPC**: `tasks:update` (to save context block), may need a dedicated IPC for column history creation
- **LLM service**: T-002 provides text generation
- **Focus View actions**: T-004's "complete phase" and "defer" actions will integrate with this flow
- **Board View drag**: T-005's column drag will also integrate

## Implementation Notes

- **Component**: Create `src/renderer/src/components/ContextCapture.tsx` — a modal/dialog that appears during transitions. Props: task, transition type, onConfirm, onSkip.
- **LLM prompt**: "You are updating the context summary for a developer's task. The task is moving from [column] to [column] because [reason]. Here's the previous context: [contextBlock]. Generate an updated 3–5 sentence summary covering: where they left off, key decisions made, and the next concrete action."
- **Integration points**: This component needs to be invoked from:
  - Focus View "complete phase" action (T-004)
  - Focus View "defer" action (T-004)
  - Board View column drag (T-005)
  - Preemption (when a triggered task takes over in Focus View — may be triggered by T-010)
- **Linked resource updates**: For v1, this can be deferred. Fetching current CLI state and diffing against stored metadata adds complexity. Start with generating context from the existing context block + transition info. Add CLI diffing as an enhancement.
- **Column history**: After context capture, create a `columnHistory` record with `fromColumn`, `toColumn`, `contextSnapshot`, and `movedAt`. This may need a new IPC handler or be bundled into the `tasks:update` call.
- **"Confirm or edit later"**: For preemption, auto-accept the generated context and flag the task for review later. A simple boolean `contextNeedsReview` field could work, but it's not in the current schema — consider adding it or just relying on the user to edit when they next see the task.

## Testing Requirements

**Coverage target: 80% line coverage.**

### Renderer tests (jsdom Vitest project):

1. **Modal renders**: Verify context capture dialog appears with generated text.
2. **Confirm saves**: Click confirm — verify `tasks:update` called with new context block.
3. **Edit and confirm**: Modify text, confirm — verify updated text is saved.
4. **Skip retains old context**: Click skip — verify task's context block is unchanged.
5. **Phase transition always prompts**: Verify modal appears on column change.
6. **Defer allows skip**: Verify skip button is available on defer.
7. **Preempt auto-confirms**: Verify preemption uses auto-generated context with "edit later" option.

### Main process tests (node Vitest project):

8. **Column history created**: On phase transition, verify `columnHistory` record is created with correct data.

## Documentation

- Document the context capture flow and its integration points in `docs/ARCHITECTURE.md`.

## E2E Testing

At least one Playwright e2e test covering the core user flow. Uses the e2e helpers and patterns established in T-014.

Since context capture uses LLM-generated text, the e2e test should either mock the LLM response via the IPC bridge or test the flow with a fallback/empty context.

1. **Context capture on column transition**: Seed a task in Planning → navigate to Focus View → click "complete phase" → verify the context capture modal appears → confirm (or edit and confirm) → verify the task moves to In Progress and the context is saved.
2. **Skip on defer**: Seed a task → navigate to Focus View → click "defer" → verify context capture prompt appears with a skip option → click skip → verify the next task appears without modifying the original task's context.

## Verification

1. Run `npm run test` — context capture tests pass.
2. Run `npx playwright test e2e/context-capture.spec.ts` — e2e tests pass.
3. Run `npm run dev`:
   - Move a task from Planning to In Progress via Focus View — verify context capture dialog appears.
   - Confirm the generated context — verify it's saved and visible on the task.
   - Defer a task — verify context capture prompt with skip option.
   - Check Archive View — verify column history shows transitions with context snapshots.
