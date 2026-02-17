---
id: T-007b
title: 'URL-based Auto-population'
status: ready
priority: 3
dependencies: ['T-002', 'T-007a']
spec_refs: ['§4.1', '§4.2']
adrs: []
estimated_complexity: M
tags: [workflow, llm]
created: 2026-02-16
updated: 2026-02-17
---

# T-007b: URL-based Auto-population

## Context

When a user pastes a URL into the quick-add field on the Board View, the app detects it as a URL and triggers an auto-population flow instead of a plain title entry. A task is created immediately (with the URL as its temporary title), then metadata is fetched from the URL's source (GitHub, Azure DevOps), an LLM generates a context summary, and the task is updated in place. The card shows a loading state during this process and can be cancelled.

> **Scope change from original spec**: This was originally framed as enhancing an intake form's URL field. The intake form has been dropped — instead, URL detection happens in the existing quick-add field on the Board View. T-007a is still a prerequisite because it adds the `links:create` IPC infrastructure that this task uses to save auto-populated links.

## Requirements

1. **URL detection in quick-add**: When the user types or pastes a value into the quick-add title field, detect if it is a URL (starts with `http://` or `https://`). If so, suppress normal title-based creation and trigger the auto-population flow instead.

2. **Immediate task creation**: Create the task right away via `tasks:create` with `title` set to the pasted URL and the column/project from the quick-add context. The task card appears on the board immediately.

3. **Loading state**: The newly created card shows a loading indicator (spinner) and is visually dimmed. The card is not clickable/editable while loading. A cancel button ("✕") is visible on the card.

4. **Cancel**: Clicking cancel calls `tasks:archive` to remove the card from the board and aborts the in-flight fetch if still running.

5. **Source detection**: In the main process, parse the URL to detect its type:
   - `github.com/<owner>/<repo>/issues/<number>` → `github_issue`
   - `github.com/<owner>/<repo>/pull/<number>` → `github_pr`
   - `dev.azure.com/<org>/<project>/_workitems/edit/<id>` → `azure_devops`
   - Anything else → `other` (skip metadata fetch, go straight to success with URL as title)

6. **CLI metadata fetch**: For recognized source types, run the appropriate CLI command from the main process:
   - **GitHub issue**: `gh issue view <number> --repo <owner>/<repo> --json title,body,state,labels,assignees`
   - **GitHub PR**: `gh pr view <number> --repo <owner>/<repo> --json title,body,state,labels,reviewDecision,statusCheckRollup`
   - **Azure DevOps**: `az boards work-item show --id <id> --org <org> --project <project>`

7. **LLM context generation**: Send the fetched metadata to the LLM to generate a 3–5 sentence context summary: what the task is about, key constraints or decisions, and the next concrete action.

8. **Project auto-association**: Compare the URL's `owner/repo` (or `org/project`) against each project's `repoAssociations`. If matched, update the task's `projectId` to the matched project. If no match, leave the task in its original project (the one the quick-add column belongs to).

9. **On success**: Update the task via `tasks:update` with: `title` ← resource title, `contextBlock` ← LLM summary. Create links via `links:create`: the original URL with the detected `sourceType` and `isPrimary: true`.

10. **On failure** (CLI not installed, auth failure, network error, LLM error): Update the task via `tasks:update` with `title` set to the pasted URL (already set from creation, so this is a no-op in effect). Clear the loading state. The card becomes a normal editable task with the URL as its title.

11. **Loading state is renderer-only**: Track which task IDs are currently fetching in a `Set` in React state (or context). No DB column needed — if the app restarts mid-fetch, the task remains with the URL as title, which is the same as the failure state.

## Existing Code

- **Quick-add**: `src/renderer/src/views/BoardView.tsx` — `handleInlineAdd()`, the inline title input per column
- **IPC**: `tasks:create`, `tasks:update`, `tasks:archive`, `links:create` (added by T-007a), `projects:list`
- **LLM service**: `src/main/llm/` — `generateText` / `generateObject` from T-002
- **Links schema**: `src/main/db/schema/links.ts` — `sourceType`, `isPrimary` fields
- **Projects schema**: `repoAssociations` field on projects

## Implementation Notes

- **URL detection**: A simple regex or `URL` constructor check in the renderer, before calling `handleInlineAdd`. If it starts with `http://` or `https://`, branch to the auto-populate flow.
- **New IPC channel**: `intake:fetchMetadata` — takes `{ url: string }`, returns `{ title: string, contextBlock: string, sourceType: LinkSourceType, repoKey: string | null }` or throws on unrecoverable error. Graceful degradation (CLI missing, auth failed) returns `null` so the renderer can handle it as a failure.
- **URL parser**: Create `src/main/cli/urlParser.ts` — parses URLs to detect `sourceType` and extract owner/repo/number or org/project/id.
- **CLI executor**: Create `src/main/cli/executor.ts` — wraps `child_process.execFile` with a timeout. Returns stdout or throws with a structured error. All commands are read-only.
- **Abort**: Use an `AbortController` (or just ignore the result) when the user cancels. Since the task is already archived on cancel, a late-arriving result should be dropped if the task no longer exists.
- **Loading card UI**: Add a `fetchingTaskIds: Set<number>` state in BoardView. Cards whose id is in this set render the loading overlay instead of normal card content.

## Testing Requirements

**Coverage target: 80% line coverage.**

### Unit tests — node Vitest project:

1. **URL parser — GitHub issue**: `https://github.com/org/repo/issues/42` → `{ type: 'github_issue', owner: 'org', repo: 'repo', number: 42 }`.
2. **URL parser — GitHub PR**: `https://github.com/org/repo/pull/99` → `{ type: 'github_pr', ... }`.
3. **URL parser — Azure DevOps**: `https://dev.azure.com/org/proj/_workitems/edit/123` → `{ type: 'azure_devops', ... }`.
4. **URL parser — generic**: `https://example.com/foo` → `{ type: 'other' }`.
5. **CLI executor — success**: Mock `execFile` to resolve with JSON stdout — verify parsed result returned.
6. **CLI executor — CLI not installed**: Mock `execFile` failure with ENOENT — verify null returned (graceful degradation).
7. **Project auto-association**: Mock projects with `repoAssociations` — verify correct project matched; unmatched repo returns null.

### Renderer tests — jsdom Vitest project:

8. **URL paste triggers fetch**: Type a `https://` URL into quick-add and submit — verify `intake:fetchMetadata` IPC is called and task is created immediately.
9. **Loading state shown**: While fetching, verify the card renders with a loading indicator and is not clickable.
10. **Cancel archives task**: Click cancel on a loading card — verify `tasks:archive` is called with the task id.
11. **On success — fields updated**: After metadata returns, verify `tasks:update` called with correct title and contextBlock, and `links:create` called with correct sourceType and isPrimary.
12. **On failure — title stays as URL**: When `intake:fetchMetadata` throws, verify `tasks:update` is NOT called and loading state is cleared (card becomes normal editable task).
13. **Generic URL — no metadata fetch**: Paste a non-GitHub/Azure URL — verify `intake:fetchMetadata` is still called but no CLI command runs, and the task is created with the URL as title.

## E2E Testing

Since this feature depends on external CLI tools and LLM calls, e2e tests focus on the graceful degradation path and UI flow.

1. **Generic URL creates task**: Seed a project → paste a generic `https://` URL into quick-add → verify a task card appears on the board with the URL as its title (no crash, no hang).
2. **Cancel removes card**: Paste a GitHub-shaped URL (fetch will fail since `gh` won't be authed in test) → while loading indicator is visible, click cancel → verify the card is removed from the board.
3. **Failure degrades gracefully**: Paste a GitHub-shaped URL → wait for fetch to fail → verify the card is no longer in loading state and has the URL as its title.

## Verification

1. Run `npm run test` — all new tests pass.
2. Run `npx playwright test e2e/url-auto-population.spec.ts` — e2e tests pass.
3. Run `npm run dev`:
   - Paste a GitHub issue URL into the quick-add field — verify a loading card appears immediately, then populates with the issue title and LLM context.
   - Paste a URL from a repo associated with a project — verify the task moves to that project.
   - Paste a generic URL — verify task is created with the URL as title (no fetch attempted).
   - Paste a GitHub URL with `gh` not authenticated — verify graceful fallback (URL stays as title, card becomes editable).
   - Click cancel on a loading card — verify it disappears.
