---
id: T-006
title: 'Archive View'
status: ready
priority: 2
dependencies: []
spec_refs: ['§2.3']
adrs: []
estimated_complexity: S
tags: [ui]
created: 2026-02-14
updated: 2026-02-14
---

# T-006: Archive View

## Context

The Archive View is a searchable, read-only list of completed tasks. It serves as a reference and history view — the user can look back at what was done, when, and what the final context was.

This is the simplest of the three views.

## Requirements

1. **List of archived tasks**: Display all tasks where `archived = true`, ordered by completion time (most recent first).

2. **Content per archived task**:
   - Task title
   - Project name (with project color indicator)
   - Final context block (the `contextBlock` as it was at completion)
   - Links (clickable URLs)
   - Timestamps: created (`createdAt`), completed (the `movedAt` from the last `columnHistory` entry, or `updatedAt`)
   - Column transition history — a timeline showing when the task moved through each phase (from `columnHistory` records)

3. **Search**: A text input that filters tasks by title and context block content. Client-side filtering is fine for v1 (unlikely to have thousands of archived tasks). If performance becomes an issue, move to SQL LIKE queries.

4. **Read-only**: No editing, no unarchiving. This is pure reference.

5. **Empty state**: When no tasks are archived, show "No completed tasks yet."

## Existing Code

- **View stub**: `src/renderer/src/views/ArchiveView.tsx` — currently shows placeholder text
- **IPC**: `tasks:list` returns tasks (filter by `archived = true` client-side, or add a dedicated `tasks:listArchived` channel). Column history is in the `columnHistory` table — may need a new IPC channel to fetch history for a task.
- **Preload API**: `window.api.tasks.*`
- **Shared types**: `Task`, `Project`, `Link` interfaces. May need a `ColumnHistoryEntry` type.
- **DB schema**: `tasks`, `columnHistory`, `links`, `projects` tables

## Implementation Notes

- **Data fetching**: Fetch archived tasks with their project data, links, and column history. This may require a new IPC handler (`tasks:listArchived`) that joins across tables and returns enriched task records, or multiple IPC calls composed in the renderer.
- **Column history display**: Render as a simple vertical timeline. Each entry shows: `fromColumn → toColumn` with `movedAt` timestamp and optionally the `contextSnapshot` captured at that transition.
- **Search**: Use a controlled input with `useState`. Filter the task list by checking if the search term appears in the title or context block (case-insensitive substring match).
- **Timestamps**: Use `Intl.DateTimeFormat` or a lightweight date utility for formatting. Show relative times for recent items ("2 hours ago") and absolute dates for older items ("Jan 15, 2026").
- **Expandable cards**: Show compact info (title, project, dates) with click-to-expand for full context block and column history. This keeps the list scannable.

## Testing Requirements

**Coverage target: 80% line coverage.**

### Renderer tests (jsdom Vitest project):

1. **Renders archived tasks**: Mock IPC with archived tasks — verify they render in completion order.
2. **Task content displays**: Verify title, project name, context block, timestamps render.
3. **Links render**: Verify links display with correct href.
4. **Column history renders**: Verify transition timeline displays.
5. **Search filters**: Type a search term — verify only matching tasks show.
6. **Empty state**: Mock IPC with no archived tasks — verify empty state message.

### Main process tests (if new IPC handler is added):

7. **Archive query**: Verify the query returns only archived tasks with correct joins.

## Documentation

- No significant architectural additions — this is a straightforward read-only view.

## Verification

1. Run `npm run test` — Archive View tests pass.
2. Run `npm run dev`:
   - Complete a few tasks (move through columns to archive).
   - Navigate to Archive View — see completed tasks with history.
   - Use search to filter by title.
   - Verify column history shows correct transitions.
