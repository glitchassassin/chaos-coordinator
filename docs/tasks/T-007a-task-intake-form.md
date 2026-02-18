---
id: T-007a
title: 'Task Edit — Links Support'
status: done
priority: 3
dependencies: []
spec_refs: ['§4.1']
adrs: []
estimated_complexity: S
tags: [ui, workflow]
created: 2026-02-16
updated: 2026-02-17
---

# T-007a: Task Edit — Links Support

## Context

The task edit modal in BoardView currently supports title, context block, and column. This task adds link management to that modal, so tasks can have associated URLs (GitHub issues, PRs, Azure DevOps work items, or generic links) that are visible and editable. This also adds the IPC infrastructure (`links:list`, `links:create`, `links:delete`) that T-007b depends on to save auto-populated links.

> **Scope change from original spec**: The original T-007a planned a standalone "New Task" intake form modal. That has been dropped — task creation flows through the existing quick-add (plain text) or URL paste in the quick-add (handled by T-007b). This task is now focused solely on adding link management to the existing task edit experience.

## Requirements

1. **Links section in task edit modal**: Below the existing fields (title, context block, column), show a "Links" section listing any links already associated with the task.

2. **Link display**: Each link shows its URL and label (if set). A small icon indicates `sourceType` (`github_issue`, `github_pr`, `azure_devops`, `other`).

3. **Add link**: An "Add link" button appends a new row with URL input and optional label input. On save, call `links:create` with `{ taskId, url, label, sourceType: 'other' }`. `sourceType` defaults to `'other'` — T-007b sets correct types for auto-populated links.

4. **Remove link**: Each link row has a remove button. On remove, call `links:delete` with the link id. Confirmed immediately (no extra confirmation dialog).

5. **Load links on open**: When the edit modal opens, call `links:list` with the task id to fetch existing links.

6. **Keyboard accessible**: Tab order covers all link rows and the add/remove buttons. Escape still closes the modal.

## Existing Code

- **Edit modal**: `src/renderer/src/views/BoardView.tsx` — the modal rendered when `editingTask` is set (currently handles title, contextBlock, column, archive)
- **Links schema**: `src/main/db/schema/links.ts` — `id`, `taskId`, `url`, `label`, `sourceType`, `isPrimary`, `createdAt`
- **Shared types**: `src/shared/types/models.ts` — `Link` interface
- **Modal component**: `src/renderer/src/components/Modal.tsx`

## Implementation Notes

- **New IPC handlers**: Add `links:list`, `links:create`, `links:delete` to a new file `src/main/ipc/links.ts`. Register in `src/main/ipc/index.ts`.
- **New IPC channels**: Add channel constants to `src/shared/constants/channels.ts`.
- **Preload**: Expose `window.api.links.list()`, `window.api.links.create()`, `window.api.links.delete()`.
- **sourceType icon**: A small helper that maps sourceType to a unicode/emoji or SVG — keep it simple, consistent with FocusView which already renders links with source type icons.
- **Links state**: Track link list locally in the edit modal's component state. Optimistically update on add/remove.

## Testing Requirements

**Coverage target: 80% line coverage.**

### Unit tests — IPC (node Vitest project):

1. **`links:list`**: Returns all links for a given taskId.
2. **`links:create`**: Inserts a link row, returns the new link.
3. **`links:delete`**: Deletes the link by id.

### Renderer tests (jsdom Vitest project):

4. **Links section renders**: Open edit modal for a task with existing links — verify links list is shown.
5. **Add link**: Click "Add link", fill URL and label, save — verify `links:create` IPC called with correct data.
6. **Remove link**: Click remove on an existing link — verify `links:delete` called with correct id and link disappears from UI.
7. **Empty state**: Edit modal for task with no links — verify "Add link" button is present and no link rows shown.
8. **Keyboard navigation**: Tab reaches all link inputs and add/remove buttons.

## E2E Testing

1. **Add and persist link**: Seed a task → open edit modal → add a link with URL and label → save → reopen modal → verify link is still present.
2. **Remove link**: Seed a task with a link → open edit modal → remove the link → save → reopen modal → verify link is gone.

## Verification

1. Run `npm run test` — all new tests pass.
2. Run `npx playwright test e2e/task-links.spec.ts` — e2e tests pass.
3. Run `npm run dev`:
   - Open the edit modal for any task.
   - Add a link with a URL and label — verify it saves and reappears on reopen.
   - Remove a link — verify it's gone on reopen.
   - Verify keyboard navigation covers all link fields.
