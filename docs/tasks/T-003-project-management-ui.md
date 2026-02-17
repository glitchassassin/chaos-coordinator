---
id: T-003
title: 'Project Management UI'
status: done
priority: 2
dependencies: []
spec_refs: ['§8.1', '§8.2']
adrs: []
estimated_complexity: L
tags: [ui, settings, color, accessibility]
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
   - Background image (optional, via native file picker — see requirement 7)
   - Primary color and accent color (color pickers, auto-derived from image — see requirements 8–9)
   - Repository associations (list of repo identifiers like `org/repo`, used for auto-matching in intake)

3. **Edit project**: Click a project to edit any of its properties.

4. **Delete project**: Delete a project and all its tasks. Show a confirmation dialog.

5. **Reorder projects**: Drag to reorder projects, which changes their `priorityRank`. This directly affects task priority (§3.1 rule 3) and Board View swim lane order.

6. **Visual identity preview**: When editing colors/background, show a live preview of how the project will look in Focus View. The preview should show the background image (if set), the primary color as the header/title area background, the accent color as a secondary highlight, and the auto-derived text colors overlaid — so the user can immediately see whether the combination is readable and appealing.

7. **Image file picker**: The background image field uses Electron's native file dialog (`dialog.showOpenDialog`) filtered to image types (PNG, JPG, WebP). When the user selects a file, the app copies it into its app-data directory (ensures the image persists even if the original is moved/deleted). The stored `backgroundImage` value is the path to this copied file.

8. **Auto-derive colors from image**: When a background image is selected (or changed), the app extracts a color palette from the image and proposes default primary and accent colors. The user can accept the defaults or tweak them manually via the color pickers.

   **Extraction behavior:**
   - Use k-means clustering on the image pixels (via Electron's `nativeImage` for decoding — no extra native dependencies). Resize the image to 64×64 before clustering for performance. Extract `k=5` cluster centers, sorted by cluster size (largest first).
   - **Primary color**: The largest cluster center.
   - **Accent color**: The second-largest cluster center.
   - The full palette (up to 5 colors) is presented in the UI via `PalettePicker` so the user can select any extracted color for either primary or accent.
   - If the image yields fewer than two usable colors (e.g., fully transparent), keep the current colors unchanged.

9. **Color quality constraints**: Text readability is enforced automatically; color distinction is left to the user via the live preview.

   **a. Text contrast (WCAG AA):**
   - Text color is auto-derived at render time: pick white (`#ffffff`) or dark (`#1a1a2e`), whichever yields a higher contrast ratio against the background color. This is a pure function — no new DB fields needed.
   - The preview (requirement 6) overlays the derived text so the user can visually verify readability.

   **b. Primary/accent distinction:**
   - No programmatic warning is shown. The live preview (requirement 6) lets the user judge whether their chosen primary and accent are sufficiently distinct.

10. **Navigation**: Accessible from the top nav bar. Add a "Settings" or "Projects" link to the `Layout.tsx` navigation.

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
- **Delete cascade**: The IPC handler should delete the project's tasks before deleting the project itself. The FK uses `onDelete: 'set null'`, so explicit deletion is needed.
- **Tailwind v4**: Use Tailwind utility classes. The project is on Tailwind v4 — check `app.css` for the import style.

### Color extraction and image handling

- **No extra dependencies for color extraction**: Uses Electron's `nativeImage` for decoding and a custom k-means implementation for clustering. No `node-vibrant` needed.
- **New IPC channels** (add to `src/shared/types/ipc.ts` and implement in `src/main/ipc/`):
  - `dialog:open-image` — wraps `dialog.showOpenDialog` with filters for `['png', 'jpg', 'jpeg', 'webp']`. Returns the selected file path (or `null` if cancelled).
  - `colors:extract-palette` — takes an image file path, runs k-means clustering, and returns `{ colors: string[] }` (hex values, up to 5). The renderer presents these in `PalettePicker` for user selection.
  - `files:copy-to-app-data` — copies the selected image into `app.getPath('userData')/project-images/` with a unique filename (e.g., UUID). Returns the destination path. This is what gets stored in `backgroundImage`.
- **Color utility module** (`src/shared/lib/color-utils.ts`):
  - `contrastRatio(hex1, hex2)` → number (implements WCAG relative luminance formula)
  - `textColorOn(backgroundHex)` → `'#ffffff'` or `'#1a1a2e'` (whichever has higher contrast)
  - `ciede2000(hex1, hex2)` → number (perceptual color difference — available for future use)
  - `hexToLab(hex)` → `{ L, a, b }` (intermediate conversion for CIEDE2000)
  - Keep these as pure functions — easy to test, no side effects. Shared between main and renderer.
- **No schema changes**: Text colors are computed at render time from `colorPrimary` / `colorAccent`. No new DB columns needed.

## Testing Requirements

**Coverage target: 80% line coverage.**

### Shared utility tests (node Vitest project):

1. **`contrastRatio`**: Verify known pairs — white/black → 21:1, white/white → 1:1, mid-gray/#000000 → known ratio. Use exact values from the WCAG spec examples.
2. **`textColorOn`**: Light backgrounds (e.g., `#f0f0f0`) → dark text. Dark backgrounds (e.g., `#1a1a2e`) → white text. Edge cases near the midpoint (e.g., `#808080`).
3. **`ciede2000`**: Identical colors → 0. Ensure symmetric: `ciede2000(a, b) === ciede2000(b, a)`. Perceptually similar → small ΔE, perceptually different → large ΔE.

### Color extraction tests (node Vitest project):

4. **k-means clustering**: Empty input → empty result. Single color → one cluster. Two distinct colors → two clusters. Largest cluster sorted first.
5. **`extractPalette`**: Mock `nativeImage` with synthetic bitmaps. Verify valid hex output (`/^#[0-9a-f]{6}$/i`), empty image → empty array, transparent pixels skipped.
6. **Extraction result satisfies text contrast**: For extracted colors, verify that `contrastRatio(textColorOn(color), color) >= 4.5`.

### Renderer tests (jsdom Vitest project):

7. **Project list renders**: Mock IPC, verify projects display in order.
8. **Create form**: Fill and submit the create form, verify IPC call with correct data.
9. **Edit form**: Click a project, modify fields, save — verify IPC update call.
10. **Delete confirmation**: Click delete, confirm dialog appears, confirm triggers IPC delete.
11. **Reorder**: Simulate drag reorder, verify `priorityRank` updates are sent via IPC.
12. **Image selection triggers color extraction**: Mock the `dialog:open-image` and `colors:extract-palette` IPC calls. After selecting an image, verify the color pickers update with the extracted values.
13. **Preview updates live**: Change a color picker value, verify the preview re-renders with the new color and correct derived text color.

### Main process tests (node Vitest project):

14. **Delete cascades**: Delete a project, verify its tasks are deleted (not just archived).
15. **Image copy to app data**: Call `files:copy-to-app-data` with a test image, verify the file exists in the app-data directory and the returned path is correct.

## Documentation

- Update `docs/ARCHITECTURE.md` if a new routing pattern or component convention is established.

## Verification

1. Run `npm run test` — all project management and color utility tests pass.
2. Run `npm run dev`:
   - Navigate to the Projects view from the nav bar.
   - Create a project with just a name (no image) — verify default colors are applied.
   - Edit the project — click "Choose Image", select a colorful photo. Verify:
     - The image preview appears.
     - The color pickers update to extracted values.
     - The preview shows readable text over the primary and accent colors.
   - Save the project.
   - Create a second project.
   - Drag to reorder the two projects.
   - Delete a project — confirm its tasks are deleted.
   - Restart the app — verify the background image still loads (was copied to app data, not referencing the original path).
