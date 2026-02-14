---
id: T-007
title: 'Task Intake'
status: ready
priority: 3
dependencies: ['T-002']
spec_refs: ['§4.1', '§4.2']
adrs: []
estimated_complexity: L
tags: [workflow, llm]
created: 2026-02-14
updated: 2026-02-14
---

# T-007: Task Intake

## Context

Task intake is how work enters the system. The user pastes a URL (GitHub issue, PR, Azure DevOps work item, etc.), the system fetches metadata via CLI tools, an LLM generates a context summary, and a pre-populated task card is presented for review and confirmation.

This is a key part of the "minimal interaction overhead" principle — intake should be fast and mostly pre-populated.

## Requirements

1. **Intake field**: A prominent text input (accessible from Board View and/or a global shortcut) where the user pastes a URL.

2. **Source detection and metadata fetch**: When a URL is pasted:
   - Detect the source type (GitHub issue, GitHub PR, Azure DevOps work item, generic URL)
   - Use the appropriate CLI tool to fetch metadata:
     - **GitHub issue**: `gh issue view <number> --repo <owner/repo> --json title,body,state,labels,assignees,comments`
     - **GitHub PR**: `gh pr view <number> --repo <owner/repo> --json title,body,state,labels,reviewDecision,statusCheckRollup,comments`
     - **Azure DevOps**: `az boards work-item show --id <id> --org <org> --project <project>` (extract from URL)
   - Parse the CLI output into structured metadata.

3. **LLM context generation**: Send the fetched metadata to the LLM (via T-002) with a prompt to generate a 3–5 sentence context summary covering: what the task is about, key decisions/constraints mentioned, and a suggested next action.

4. **Project auto-association**: Match the repository (from the URL) against existing projects' `repoAssociations`. If matched, auto-select the project. If the repo is unknown, prompt the user to assign it to an existing project or create a new one.

5. **Pre-populated task card**: Present a form with:
   - Title (auto-populated from the linked resource's title, editable)
   - Context block (LLM-generated, editable)
   - Links (the pasted URL plus any discovered linked resources)
   - Project (auto-matched or user-selected)
   - Column (default: Planning, editable)
   - Trigger condition (optional, user-specified — free text input)

6. **Confirm and create**: User reviews, optionally edits, and confirms. Task is created via `tasks:create` IPC.

## Existing Code

- **IPC**: `tasks:create`, `projects:list` (for project selection and repo matching)
- **Preload API**: `window.api.tasks.create()`, `window.api.projects.list()`
- **LLM service**: T-002 provides `generateText`/`generateObject` for context generation
- **Shared types**: `Task`, `Link`, `Project`, `TaskColumn`
- **Links schema**: `src/main/db/schema/links.ts` — `sourceType` field for `github_issue`, `github_pr`, `azure_devops`, `other`

## Implementation Notes

- **URL parsing**: Create a utility that parses URLs to detect source type:
  - `github.com/<owner>/<repo>/issues/<number>` → GitHub issue
  - `github.com/<owner>/<repo>/pull/<number>` → GitHub PR
  - `dev.azure.com/<org>/<project>/_workitems/edit/<id>` → Azure DevOps
  - Anything else → `other` (just store as a link, skip metadata fetch)
- **CLI execution**: Run CLI commands from the main process using Node's `child_process.execFile`. Create a utility module (e.g., `src/main/cli/executor.ts`) that runs commands and returns stdout/stderr. All commands in intake are **read-only** — no safety classification needed here.
- **Error handling**: If `gh` or `az` is not installed, or the command fails (auth issues, network, etc.), gracefully degrade — still allow manual task creation with just the URL as a link.
- **LLM prompt for context**: Something like: "Given the following [issue/PR/work item] metadata, write a 3–5 sentence context summary for a developer picking up this work. Cover: what this is about, key constraints or decisions already made, and the next concrete action to take."
- **Component location**: Create `src/renderer/src/components/TaskIntake.tsx` (or `src/renderer/src/views/IntakeView.tsx`). Could be a modal/slide-out from Board View, or a dedicated route.
- **IPC for CLI**: Add IPC channels for metadata fetch (e.g., `cli:fetchGithubIssue`, `cli:fetchGithubPr`, `cli:fetchAzureWorkItem`) that handle the command execution in the main process and return parsed results to the renderer.

## Testing Requirements

**Coverage target: 80% line coverage.**

### Unit tests (node Vitest project):

1. **URL parser**: Test detection of GitHub issue, PR, Azure DevOps, and generic URLs.
2. **CLI metadata fetch**: Mock `child_process.execFile`. Test that correct commands are constructed for each source type. Test JSON parsing of CLI output.
3. **Error handling**: Test graceful degradation when CLI is not installed or command fails.
4. **Project auto-association**: Test repo matching against project `repoAssociations`.

### Renderer tests (jsdom Vitest project):

5. **Intake form renders**: Verify all fields are present.
6. **URL paste triggers fetch**: Mock IPC — paste a URL, verify metadata fetch is called.
7. **Pre-populated fields**: After metadata returns, verify title, context, project are filled.
8. **Unknown repo prompts**: Verify project selection appears when repo doesn't match.
9. **Submit creates task**: Fill form, submit — verify `tasks:create` IPC called with correct data.

## Documentation

- Add a section to `docs/ARCHITECTURE.md` describing the intake flow, CLI integration, and the URL → metadata → LLM → task pipeline.

## Verification

1. Run `npm run test` — intake tests pass.
2. Run `npm run dev`:
   - Paste a GitHub issue URL into the intake field.
   - Verify metadata is fetched (title, labels populated).
   - Verify LLM generates a context summary.
   - Verify project auto-matches if the repo is associated.
   - Confirm and verify the task appears on the board.
   - Test with an unknown repo URL — verify project selection prompt.
   - Test with `gh` not authenticated — verify graceful fallback.
