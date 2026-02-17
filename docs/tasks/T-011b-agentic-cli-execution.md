---
id: T-011b
title: 'Agentic CLI + Task Management'
status: ready
priority: 4
dependencies: ['T-002', 'T-009', 'T-011a']
spec_refs: ['§7.1', '§7.2']
adrs: ['003']
estimated_complexity: M
tags: [ui, llm, safety]
created: 2026-02-16
updated: 2026-02-16
---

# T-011b: Agentic CLI + Task Management via Chat

## Context

This task adds agentic capabilities to the chat panel (T-011a) — the LLM can execute CLI commands and manage tasks/projects through tool calls. Commands are safety-classified (T-009) before execution: read-only commands run automatically, mutating commands require user approval.

Split from T-011 (Chat Interface). Requires T-011a (chat panel) and T-009 (command safety).

## Requirements

1. **LLM tool definitions**: The LLM has access to tools:
   - `executeCommand(command: string)` — run a CLI command
   - `listTasks(filters?)` — query tasks by project, column, status
   - `updateTask(id, changes)` — modify a task (move column, update title, etc.)
   - `createTask(data)` — create a new task
   - `listProjects()` — query projects

2. **Command safety integration** (section 7.2):
   - Before executing a CLI command, classify it using T-009's `classifyCommand()`
   - **Read-only commands**: Execute immediately, show output in chat
   - **Mutating commands**: Pause and show the user an approval prompt with the command and classification reason. User can approve, edit, or reject.

3. **Command approval UI**: For mutating commands, show:
   - The command in a code block
   - The safety classification and reason
   - Approve / Edit / Reject buttons
   - On approve: execute and show output
   - On reject: inform the LLM the command was rejected

4. **Command output display**: CLI outputs render in code blocks within the chat. Long outputs should be scrollable or truncated with "show more".

5. **Task management via natural language**: The LLM uses task/project tools to handle requests like:
   - "Move the auth refactor to In Progress"
   - "Create a task for investigating the memory leak"
   - "What tasks are waiting on triggers?"

6. **Tool call visibility**: When the LLM makes a tool call, show it in the chat (e.g., a collapsible block showing the tool name and arguments) so the user can see what actions are being taken.

## Existing Code

- **Chat panel**: T-011a provides the panel UI, streaming, and conversation management
- **Command safety**: T-009's `classifyCommand()` function
- **IPC handlers**: All task and project CRUD handlers exist
- **LLM service**: T-002 supports tool definitions with `generateText`

## Implementation Notes

- **Tool calling architecture**: The main process handles tool calls in the chat loop:
  1. Send user message + tools to LLM
  2. If LLM returns a tool call -> execute it (with safety check for CLI commands)
  3. Send tool result back to LLM for the next response
  4. Repeat until LLM returns a text response (no more tool calls)
- **Component additions**: Add to `src/renderer/src/components/Chat/`:
  - `CommandApproval.tsx` — approval UI for mutating commands
  - `ToolCallDisplay.tsx` — shows tool calls and their results in the chat
- **IPC flow for command execution**:
  - Main process calls `classifyCommand()`
  - If read-only: execute, return result to LLM loop
  - If mutating: send approval request to renderer via `chat:commandApproval`, wait for response via `chat:approveCommand` or `chat:rejectCommand`, then continue
- **Task/project tools**: These call the existing IPC handlers directly in the main process — no CLI needed. The LLM formulates the correct parameters from the user's natural language.
- **Error handling**: If a command fails, send the error back to the LLM so it can explain to the user.

## Testing Requirements

**Coverage target: 80% line coverage.**

### Main process tests (node Vitest project):

1. **Tool definitions**: Verify the LLM tool schema includes all tools (executeCommand, listTasks, updateTask, createTask, listProjects).
2. **Read-only command flow**: LLM calls `executeCommand("gh pr view 123")` -> classified as read-only -> auto-executed -> result returned to LLM.
3. **Mutating command flow**: LLM calls `executeCommand("git push")` -> classified as mutating -> approval requested -> approved -> executed.
4. **Command rejected**: Mutating command rejected by user -> rejection sent back to LLM.
5. **Task management tools**: `listTasks`, `updateTask`, `createTask` call the correct IPC handlers.
6. **Multi-turn tool calling**: LLM makes multiple tool calls in sequence — verify the loop continues correctly.

### Renderer tests (jsdom Vitest project):

7. **Command approval UI**: Mutating command shows approval dialog with command, classification, and buttons.
8. **Approve executes**: Click Approve -> command executes, output appears in chat.
9. **Reject skips**: Click Reject -> command skipped, chat continues.
10. **Tool call display**: Tool calls shown in chat with name and arguments.
11. **Command output formatting**: CLI output renders in code blocks.

## E2E Testing

At least one Playwright e2e test covering the core user flow. Uses the e2e helpers and patterns established in T-014.

Agentic chat depends on LLM tool calling, so the e2e test focuses on the command approval UI flow. Seed a scenario where a mutating command approval is pending.

1. **Mutating command shows approval UI**: Open chat → trigger a scenario where a mutating command is proposed (this may require mocking the LLM tool call response via the IPC bridge) → verify the approval dialog appears with the command in a code block and Approve/Reject buttons → click Reject → verify the chat continues with a rejection message.

If mocking the full LLM tool call flow is too complex for e2e, this test can be deferred to be covered by the unit tests in the renderer project, with a note explaining why.

## Verification

1. Run `npm run test` — agentic chat tests pass.
2. Run `npx playwright test e2e/agentic-chat.spec.ts` — e2e tests pass.
3. Run `npm run dev`:
   - Open chat and ask "what's the status of PR #123 in org/repo?" — verify it runs `gh pr view` automatically and shows results.
   - Ask "merge PR #123" — verify it shows the command for approval before executing.
   - Reject a mutating command — verify the LLM acknowledges the rejection.
   - Ask "move task X to In Progress" — verify the task moves on the board.
   - Ask "create a task for fixing the login bug" — verify a task is created.
