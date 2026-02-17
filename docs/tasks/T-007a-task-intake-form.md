---
id: T-007a
title: 'Task Intake Form'
status: ready
priority: 3
dependencies: []
spec_refs: ['§4.1']
adrs: []
estimated_complexity: M
tags: [ui, workflow]
created: 2026-02-16
updated: 2026-02-16
---

# T-007a: Task Intake Form

## Context

Board View's quick-add creates tasks with just a title. This task builds a full-featured creation form with all the fields needed for rich task metadata — context blocks, links, trigger conditions, cross-project assignment, and column selection. This form also serves as the shell that T-007b enhances with URL-based auto-population.

Split from T-007 (Task Intake). See T-007b for URL-based auto-population.

## Requirements

1. **Intake form accessible from Board View**: A modal or slide-out triggered by a prominent "New Task" button (distinct from the per-column quick-add).

2. **Form fields**:
   - Title (required, text input)
   - Context block (optional, multi-line textarea — 3–5 sentence summary of what this task is about)
   - Project (required, dropdown of existing projects)
   - Column (default: Planning, selectable)
   - Links (optional, repeatable — URL + label pairs)
   - Trigger condition (optional, free text — natural language condition for when this task becomes actionable)

3. **URL input field**: A prominent text input at the top for pasting a URL. In this task it simply stores the URL as the first link. T-007b will enhance this field to trigger metadata fetch and auto-population.

4. **Confirm and create**: User reviews fields and confirms. Task is created via `tasks:create` IPC. On success, close the form and show the new task on the board.

5. **Validation**: Title and project are required. Show inline validation errors.

6. **Keyboard accessible**: All fields reachable via Tab. Escape closes the form. Enter on the confirm button submits.

## Existing Code

- **IPC**: `tasks:create`, `projects:list`, `links:create` (or bundled into task creation)
- **Preload API**: `window.api.tasks.create()`, `window.api.projects.list()`
- **Shared types**: `Task`, `Link`, `Project`, `TaskColumn`
- **Links schema**: `src/main/db/schema/links.ts` — `sourceType` field
- **Modal component**: `src/renderer/src/components/Modal.tsx`
- **Board View**: `src/renderer/src/views/BoardView.tsx` — quick-add already exists

## Implementation Notes

- **Component location**: Create `src/renderer/src/components/TaskIntakeForm.tsx`. Use the existing `Modal` component as the container.
- **Project selector**: Fetch projects via `window.api.projects.list()` on mount. Default to the current board's project if opened from a project-specific context.
- **Links management**: A dynamic list of URL + label inputs. Add/remove link rows. Each link gets `sourceType: 'other'` by default (T-007b will detect source types from URLs).
- **Trigger condition**: A simple text input. The trigger is not created at this point — just stored as metadata. When the trigger system (T-010a) is implemented, it will pick up tasks with trigger conditions.
- **Column selector**: Radio buttons or small select with the TaskColumn values (Planning, In Progress, Review).
- **Form state**: Use React `useState` or a lightweight form library. Keep it simple.

## Testing Requirements

**Coverage target: 80% line coverage.**

### Renderer tests (jsdom Vitest project):

1. **Form renders all fields**: Verify title, context, project, column, links, trigger, and URL inputs are present.
2. **Project dropdown populates**: Mock `projects:list` IPC — verify dropdown shows projects.
3. **Validation enforced**: Submit with empty title — verify error shown. Submit with no project — verify error.
4. **Links add/remove**: Add a link row — verify it appears. Remove it — verify it's gone.
5. **Submit creates task**: Fill all fields, submit — verify `tasks:create` IPC called with correct data including links.
6. **URL stored as link**: Enter a URL — verify it's included in the created task's links.
7. **Modal closes on success**: After successful creation, verify modal closes.
8. **Keyboard navigation**: Verify Tab order and Escape-to-close.

## E2E Testing

At least one Playwright e2e test covering the core user flow. Uses the e2e helpers and patterns established in T-014.

1. **Create task via intake form**: Seed a project → open Board View → open the intake form → fill in title, project, and column → submit → verify the task card appears on the board in the correct column and swim lane.
2. **Validation prevents empty submit**: Open the intake form → submit with empty title → verify the form shows a validation error and does not close.

## Verification

1. Run `npm run test` — intake form tests pass.
2. Run `npx playwright test e2e/task-intake.spec.ts` — e2e tests pass.
3. Run `npm run dev`:
   - Open the intake form from Board View.
   - Fill in title, context, select a project and column.
   - Add a link with a URL and label.
   - Submit — verify the task appears on the board in the correct column.
   - Try submitting with missing required fields — verify validation errors.
