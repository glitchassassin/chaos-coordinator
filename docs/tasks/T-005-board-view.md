---
id: T-005
title: 'Board View'
status: done
priority: 2
dependencies: []
spec_refs: ['§2.2']
adrs: []
estimated_complexity: L
tags: [ui, core]
created: 2026-02-14
updated: 2026-02-16
---

# T-005: Board View

## Context

The Board View is a kanban board showing all active work across all projects. It's used for daily planning, manual reordering, and situational awareness. Unlike Focus View (which shows one task), Board View shows everything in flight.

## Requirements

1. **Column layout** (left to right): Backlog → Planning → In Progress → Review/Verify. Each column shows task cards belonging to that phase.

2. **Swim lanes**: One horizontal lane per project, ordered top-to-bottom by project `priorityRank`. Higher-priority projects appear at the top.

3. **Card display** (compact):
   - Project color/icon indicator (small color dot or stripe)
   - Task title
   - Waiting-on indicator (if the task has an active trigger in `pending`/`polling` status): icon + short label (e.g., "⏳ Agent running", "🔨 Build pending") derived from the trigger's `nlCondition`
   - Time in current column (e.g., "2d in Planning") — computed from `columnHistory` or `updatedAt`

4. **Card visual states**:
   - **Actionable** — vivid, full opacity
   - **Waiting/blocked** — dimmed (reduced opacity), with waiting-on indicator
   - **Triggered** (just became actionable, trigger recently fired) — brief highlight animation

5. **Drag-and-drop interactions**:
   - Drag cards horizontally between columns to change a task's phase. On drop, call `tasks:update` with the new column.
   - Drag swim lanes vertically to reorder projects (changing `priorityRank`). On drop, call `projects:update` for all affected projects.

6. **Card click**: Click a card to expand it inline or in a modal. The expanded view shows: title (editable), context block (editable), links (add/remove), trigger condition (editable), column selection. Save changes via `tasks:update`.

7. **Add task**: A button or "+" affordance to create a new task. Opens a minimal form with title, project selection, and column (defaults to Planning). This is the quick-add path; full intake (T-007) is for link-based creation.

8. **Navigation**: "Switch to Focus View" button/link. Already in the nav bar via `Layout.tsx`.

## Existing Code

- **View stub**: `src/renderer/src/views/BoardView.tsx` — currently shows placeholder text
- **IPC**: `tasks:list` (all tasks), `tasks:update`, `tasks:create`, `projects:list`, `projects:update`
- **Preload API**: `window.api.tasks.*`, `window.api.projects.*`
- **Shared types**: `Task`, `Project`, `TaskColumn` enum, `TriggerStatus` enum
- **DB schema**: `tasks`, `projects`, `triggers`, `columnHistory`, `links` tables

## Implementation Notes

- **Layout approach**: CSS Grid is well-suited — 4 fixed columns, N dynamic rows (one per project swim lane). Each cell contains the cards for that project × column combination.
- **Drag-and-drop**: Consider `@dnd-kit/core` (lightweight, accessible) or native HTML5 drag-and-drop. `@dnd-kit` has better UX (smooth animations, keyboard support) but adds a dependency. Native DnD is zero-dep but rougher. Choose based on complexity tolerance.
- **Data fetching**: Fetch all tasks and all projects on mount. Group tasks by project and column for rendering. Refetch after any mutation.
- **Time in column**: Compute from the most recent `columnHistory` entry for the task, or fall back to `updatedAt` if no history exists. Display as a relative time string (e.g., "2d", "4h", "< 1h").
- **Triggered highlight**: Tasks with a trigger where `status = 'fired'` and `firedAt` is within the last hour (or configurable threshold) get a brief CSS animation (pulse or glow).
- **Swim lane reorder**: On drag-end, compute new `priorityRank` values for all projects and batch-update.
- **Card expand/edit**: A modal or slide-out panel. Keep it simple — form fields mapped to task properties with save/cancel.
- **Empty columns**: Show a subtle empty state or drop target in columns with no tasks.

## Testing Requirements

**Coverage target: 80% line coverage.**

### Renderer tests (jsdom Vitest project):

1. **Board renders columns**: Verify 4 columns render with correct headings.
2. **Swim lanes per project**: Mock 2 projects with tasks — verify each project gets a swim lane in correct priority order.
3. **Cards display correctly**: Verify task title, project indicator, time in column render.
4. **Waiting state**: Task with active trigger renders dimmed with waiting indicator.
5. **Actionable state**: Task without trigger renders at full opacity.
6. **Card click expands**: Click a card, verify expanded edit form appears with correct data.
7. **Card edit saves**: Modify title in expanded card, save — verify IPC update called.
8. **Quick-add task**: Click add button, fill form, submit — verify IPC create called with correct data.
9. **Column drag** (integration test): Simulate drag-and-drop of a card between columns, verify `tasks:update` called with new column.
10. **Swim lane reorder** (integration test): Simulate drag of a swim lane, verify `projects:update` called with new ranks.

## Documentation

- Update `docs/ARCHITECTURE.md` with Board View component structure.
- If a drag-and-drop library is chosen, note the decision and rationale.

## Verification

1. Run `npm run test` — Board View tests pass.
2. Run `npm run dev`:
   - Create 2+ projects and several tasks across columns.
   - Verify the board renders correctly with swim lanes.
   - Drag a card between columns — verify it moves and persists on refresh.
   - Drag a swim lane to reorder projects — verify new order persists.
   - Click a card to expand — edit title and save, verify change persists.
   - Add a task via the board — verify it appears in the correct column.
