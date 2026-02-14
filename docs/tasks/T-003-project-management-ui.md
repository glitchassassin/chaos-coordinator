---
id: T-003
title: 'Project Management UI'
status: ready
priority: 2
dependencies: []
spec_refs: ['§8.1', '§8.2']
adrs: []
estimated_complexity: M
tags: [ui, settings]
created: 2026-02-14
updated: 2026-02-14
---

# T-003: Project Management UI

## Context

Projects are the top-level organizer in Chaos Coordinator. Each project has a visual identity (colors, background image), a priority rank (swim lane order), and repository associations (for auto-matching during task intake). The IPC handlers for project CRUD already exist — this task builds the UI to manage projects.

Projects are created either explicitly (via this settings view) or implicitly during task intake when a link comes from an unrecognized repo (T-007). This task covers the explicit path.

## Requirements

1. **Project list view**: Display all projects in a settings/management area, ordered by priority rank.

2. **Create project**: Form to create a new project with fields:
   - Name (required)
   - Primary color and accent color (color pickers)
   - Background image (optional, file path or URL)
   - Repository associations (list of repo identifiers like `org/repo`, used for auto-matching in intake)

3. **Edit project**: Click a project to edit any of its properties.

4. **Delete project**: Delete a project. Per spec §8.2, deleting a project archives all its tasks. Show a confirmation dialog.

5. **Reorder projects**: Drag to reorder projects, which changes their `priorityRank`. This directly affects task priority (§3.1 rule 3) and Board View swim lane order.

6. **Visual identity preview**: When editing colors/background, show a preview of how the project will look in Focus View.

7. **Navigation**: Accessible from the top nav bar. Add a "Settings" or "Projects" link to the `Layout.tsx` navigation.

## Existing Code

- **IPC handlers**: `src/main/ipc/projects.ts` — full CRUD (`projects:list`, `projects:get`, `projects:create`, `projects:update`, `projects:delete`)
- **Preload API**: `src/preload/index.ts` — `window.api.projects.*` already exposed
- **Shared types**: `src/shared/types/models.ts` — `Project` interface
- **Layout**: `src/renderer/src/components/Layout.tsx` — nav bar where a link should be added
- **DB schema**: `src/main/db/schema/projects.ts` — `colorPrimary`, `colorAccent`, `backgroundImage`, `priorityRank`, `repoAssociations` fields

## Implementation Notes

- **Route**: Add a `/projects` route in `src/renderer/src/App.tsx`. Create `src/renderer/src/views/ProjectsView.tsx`.
- **Color pickers**: Use a simple HTML `<input type="color">` or a lightweight React color picker. Avoid heavy dependencies.
- **Repo associations**: The DB stores this as a JSON text field (array of strings). The UI should provide an "add/remove" interface for repo identifiers.
- **Drag reorder**: Use a lightweight drag library or native HTML drag-and-drop. On drop, update `priorityRank` for all affected projects via the `projects:update` IPC call.
- **Delete cascade**: The IPC handler / DB should handle cascading (archiving tasks). Verify this works correctly with the existing schema's foreign key cascade rules.
- **Tailwind v4**: Use Tailwind utility classes. The project is on Tailwind v4 — check `app.css` for the import style.

## Testing Requirements

**Coverage target: 80% line coverage.**

### Renderer tests (jsdom Vitest project):

1. **Project list renders**: Mock IPC, verify projects display in order.
2. **Create form**: Fill and submit the create form, verify IPC call with correct data.
3. **Edit form**: Click a project, modify fields, save — verify IPC update call.
4. **Delete confirmation**: Click delete, confirm dialog appears, confirm triggers IPC delete.
5. **Reorder**: Simulate drag reorder, verify `priorityRank` updates are sent via IPC.

### Main process tests (node Vitest project):

6. **Delete cascades**: Delete a project, verify its tasks are archived (not deleted).

## Documentation

- Update `docs/ARCHITECTURE.md` if a new routing pattern or component convention is established.

## Verification

1. Run `npm run test` — project management tests pass.
2. Run `npm run dev`:
   - Navigate to the Projects view from the nav bar.
   - Create a project with name, colors, and a repo association.
   - Edit the project — change colors, add another repo.
   - Create a second project, drag to reorder.
   - Delete a project — confirm its tasks are archived, not lost.
