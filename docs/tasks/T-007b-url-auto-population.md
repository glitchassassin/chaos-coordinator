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
updated: 2026-02-16
---

# T-007b: URL-based Auto-population

## Context

This task enhances the intake form (T-007a) with smart URL-based auto-population. When the user pastes a URL (GitHub issue, PR, Azure DevOps work item), the system detects the source, fetches metadata via CLI tools, generates an LLM context summary, and pre-populates the form fields.

Split from T-007 (Task Intake). Requires T-007a (the intake form shell).

## Requirements

1. **Source detection**: When a URL is pasted into the intake form's URL field, detect the source type:
   - `github.com/<owner>/<repo>/issues/<number>` → GitHub issue
   - `github.com/<owner>/<repo>/pull/<number>` → GitHub PR
   - `dev.azure.com/<org>/<project>/_workitems/edit/<id>` → Azure DevOps work item
   - Anything else → generic URL (no metadata fetch, just store as link)

2. **CLI metadata fetch**: For recognized URLs, fetch metadata from the main process:
   - **GitHub issue**: `gh issue view <number> --repo <owner/repo> --json title,body,state,labels,assignees,comments`
   - **GitHub PR**: `gh pr view <number> --repo <owner/repo> --json title,body,state,labels,reviewDecision,statusCheckRollup,comments`
   - **Azure DevOps**: `az boards work-item show --id <id> --org <org> --project <project>`

3. **LLM context generation**: Send fetched metadata to the LLM to generate a 3–5 sentence context summary covering: what the task is about, key constraints/decisions, and a suggested next action.

4. **Project auto-association**: Match the repository from the URL against existing projects' `repoAssociations`. If matched, auto-select the project. If unknown, leave the project selector for the user to choose.

5. **Form pre-population**: After fetch + LLM generation:
   - Title <- linked resource's title (editable)
   - Context block <- LLM-generated summary (editable)
   - Links <- the pasted URL with correct `sourceType` + any discovered linked resources
   - Project <- auto-matched or left empty

6. **Graceful degradation**: If `gh` or `az` is not installed, or the command fails (auth, network), fall back to manual entry — still store the URL as a link.

7. **Loading state**: Show a spinner/progress indicator while fetching metadata and generating context.

## Existing Code

- **Intake form**: T-007a provides the form UI with all fields
- **IPC**: `tasks:create`, `projects:list`
- **LLM service**: T-002 provides `generateText`/`generateObject`
- **Links schema**: `src/main/db/schema/links.ts` — `sourceType` field for `github_issue`, `github_pr`, `azure_devops`, `other`
- **Projects schema**: `repoAssociations` field on projects

## Implementation Notes

- **URL parser**: Create `src/main/cli/urlParser.ts` — parses URLs to detect source type and extract owner/repo/number or org/project/id.
- **CLI executor**: Create `src/main/cli/executor.ts` — runs CLI commands via `child_process.execFile`, returns stdout/stderr. All commands here are read-only.
- **IPC channels**: Add `intake:fetchMetadata` IPC channel that takes a URL, detects type, runs the CLI command, and returns structured metadata.
- **LLM prompt**: "Given the following [issue/PR/work item] metadata, write a 3–5 sentence context summary for a developer picking up this work. Cover: what this is about, key constraints or decisions already made, and the next concrete action to take."
- **Repo matching**: Compare the URL's `owner/repo` against each project's `repoAssociations` array. Case-insensitive match.
- **Enhancement to intake form**: Add an `onUrlPaste` handler to the URL field in T-007a's form. When a URL is pasted and detected as a known source, trigger the fetch flow. Pre-fill fields but keep them editable.

## Testing Requirements

**Coverage target: 80% line coverage.**

### Unit tests (node Vitest project):

1. **URL parser — GitHub issue**: `github.com/org/repo/issues/42` -> `{ type: 'github_issue', owner: 'org', repo: 'repo', number: 42 }`.
2. **URL parser — GitHub PR**: `github.com/org/repo/pull/99` -> `{ type: 'github_pr', ... }`.
3. **URL parser — Azure DevOps**: `dev.azure.com/org/proj/_workitems/edit/123` -> `{ type: 'azure_devops', ... }`.
4. **URL parser — generic**: `example.com/foo` -> `{ type: 'other' }`.
5. **CLI metadata fetch**: Mock `child_process.execFile`. Verify correct commands constructed for each source type. Verify JSON parsing of CLI output.
6. **CLI not installed**: Mock execFile failure — verify graceful degradation (returns null metadata).
7. **Project auto-association**: Mock projects with `repoAssociations` — verify matching.

### Renderer tests (jsdom Vitest project):

8. **URL paste triggers fetch**: Paste a GitHub URL — verify `intake:fetchMetadata` IPC is called.
9. **Fields pre-populated**: After metadata returns, verify title, context, project, and links are filled.
10. **Loading state**: While fetching, verify spinner is shown.
11. **Graceful fallback**: When fetch fails, verify form remains usable with just the URL as a link.
12. **Unknown repo**: URL from unassociated repo — verify project selector is not auto-filled.

## E2E Testing

At least one Playwright e2e test covering the core user flow. Uses the e2e helpers and patterns established in T-014.

Since this feature depends on external CLI tools (`gh`, `az`) and LLM calls, the e2e test focuses on the graceful degradation path and the UI flow rather than actual metadata fetching.

1. **Generic URL stored as link**: Open the intake form → paste a non-GitHub/Azure URL → verify the URL is added to the links section → submit → verify the created task has the URL as a link.
2. **Loading state on recognized URL**: Paste a GitHub-shaped URL (the fetch will fail in test since `gh` won't be authed) → verify a loading indicator briefly appears → verify the form degrades gracefully to manual entry with the URL still stored as a link.

## Verification

1. Run `npm run test` — URL intake tests pass.
2. Run `npx playwright test e2e/url-auto-population.spec.ts` — e2e tests pass.
3. Run `npm run dev`:
   - Paste a GitHub issue URL into the intake form.
   - Verify title and context auto-populate from metadata + LLM.
   - Verify project auto-matches if the repo is associated.
   - Confirm and verify the task appears on the board with correct links.
   - Test with `gh` not authenticated — verify graceful fallback to manual entry.
   - Test with a generic URL — verify it's stored as a link without metadata fetch.
