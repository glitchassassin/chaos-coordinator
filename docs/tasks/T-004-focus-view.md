---
id: T-004
title: 'Focus View'
status: done
priority: 2
dependencies: ['T-001']
spec_refs: ['§2.1']
adrs: ['007']
estimated_complexity: L
tags: [ui, core]
created: 2026-02-14
updated: 2026-02-16
completed: 2026-02-16
---

# T-004: Focus View

## Context

The Focus View is the primary interface — a full-screen, immersive display of the single highest-priority actionable task. It's where the user spends most of their time. The priority engine (T-001) determines which task to show; this task builds the UI that displays it.

ADR 007 says to build this iteratively — start functional, refine the visual treatment in use.

## Requirements

1. **Project visual identity**: The project's `colorPrimary`, `colorAccent`, and optional `backgroundImage` fill the screen as a cognitive primer. Use CSS custom properties or inline styles driven by the project's config.

2. **Task content display**:
   - Project name
   - Task title (phrased as an action)
   - Context block (3–5 sentences, the LLM-generated summary from the task record)
   - Trigger info (if applicable) — why this task surfaced now, from the trigger's `firedContext`
   - Links — clickable URLs from the task's `links` records, showing label and source type icon

3. **Ambient queue indicator**: Subtle text at the bottom edge showing queue depth (e.g., "3 tasks waiting · 2 blocked"). Data comes from the priority engine's queue depth summary.

4. **Actions**:
   - **Complete phase / move to next column**: Advances the task to the next column (planning → in_progress → review → archived). On click, the task moves forward and the next highest-priority task appears. (Context capture on transition is handled by T-008 — for now, just move the task.)
   - **Defer**: Temporarily hide this task and show the next task instead. Does not change the task's column. Deferred tasks are:
     - Stored in session-only state (persists across tab switches but not app restarts)
     - Hidden from focus for 30 minutes from the time of deferral
     - Resurfaced after 30 minutes OR if there are no other non-deferred actionable tasks in the queue
     - Tracked with `{ taskId: number, deferredAt: Date }[]` in component state
   - **Switch to Board View**: Navigate to `/board`.
   - **Open Chat**: Navigate to or open the chat interface (placeholder until T-011).

5. **Empty state**: When no tasks are actionable, show a friendly empty state (e.g., "All clear — nothing actionable right now").

6. **Transitions**: When switching between tasks (complete, defer), use a 300–500ms crossfade animation, especially when the next task is from a different project (different visual identity).

## Existing Code

- **View stub**: `src/renderer/src/views/FocusView.tsx` — currently shows placeholder text
- **IPC**: `tasks:focus` channel returns the focus task (to be enhanced by T-001). Also `tasks:update` for moving columns.
- **Shared types**: `src/shared/types/models.ts` — `Task`, `Project` interfaces. `src/shared/types/enums.ts` — `TaskColumn` enum.
- **Layout**: `src/renderer/src/components/Layout.tsx` — Focus View is the `/` route (default view)
- **Preload API**: `window.api.tasks.getFocus()`, `window.api.tasks.update()`

## Implementation Notes

- **Data fetching**: Call `window.api.tasks.getFocus()` on mount and after each action. The response includes the task, its project, links, trigger info, and queue depth.
- **Visual identity styling**: Apply project colors as CSS custom properties on a wrapper div. Use `colorPrimary` for background, `colorAccent` for interactive elements. If `backgroundImage` is set, use it as a CSS background with appropriate overlay for text readability.
- **Column progression**: The "complete phase" action should call `window.api.tasks.update({ id, column: nextColumn })`. The column order is: `planning` → `in_progress` → `review`. From `review`, the action should archive the task (`window.api.tasks.archive(id)`).
- **Defer mechanism**: Several options — (a) add a `deferredUntil` field to the task, (b) just temporarily lower its `lastTouchedAt` to push it down, or (c) maintain a session-only defer list in React state. Option (c) is simplest for v1.
- **Crossfade**: Use CSS transitions or React Transition Group. Fade out the current task, swap content, fade in. On project change, also transition the background colors/image.
- **Links display**: Fetch links via the focus response. Show each with an appropriate icon (GitHub icon for github_issue/github_pr, Azure icon for azure_devops, generic link for other).
- **Responsive layout**: Focus View should be centered, with generous whitespace. Think of it as a "reading" layout — the task content should be comfortable to scan.

## Testing Requirements

**Coverage target: 80% line coverage.**

### Renderer tests (jsdom Vitest project):

1. **Renders focus task**: Mock IPC to return a task with project data. Verify title, context block, project name render.
2. **Project visual identity applied**: Verify CSS custom properties or styles match the project's colors.
3. **Links render**: Verify links display with correct labels and href attributes.
4. **Trigger info displays**: When trigger info is present, verify it renders. When absent, verify it's hidden.
5. **Queue indicator**: Verify "X tasks waiting · Y blocked" renders with correct counts.
6. **Complete action**: Click "complete" — verify IPC update called with next column. Verify next task loads.
7. **Defer action**: Click "defer" — verify next task appears without column change.
8. **Empty state**: Mock IPC returning null — verify empty state message renders.
9. **Navigation actions**: Verify "Board View" and "Chat" buttons navigate correctly.

## Documentation

- Update `docs/ARCHITECTURE.md` with Focus View component structure and data flow.

## Verification

1. Run `npm run test` — Focus View tests pass.
2. Run `npm run dev`:
   - Create a project with colors and a task in "planning".
   - Navigate to Focus View — see the task with project visual identity.
   - Click "complete" — task moves to "in progress", verify it still shows (if highest priority).
   - Create tasks in multiple projects — verify correct priority ordering.
   - Complete or defer until empty — verify empty state appears.
