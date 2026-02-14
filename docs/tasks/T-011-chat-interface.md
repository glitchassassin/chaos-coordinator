---
id: T-011
title: 'Chat Interface'
status: ready
priority: 4
dependencies: ['T-002', 'T-009']
spec_refs: ['§7.1', '§7.2']
adrs: ['003']
estimated_complexity: L
tags: [ui, llm]
created: 2026-02-14
updated: 2026-02-14
---

# T-011: Chat Interface

## Context

The chat interface is a general-purpose conversational assistant available from any view. It provides LLM-powered interaction with agentic CLI command execution — the user can ask questions, run commands, and manage tasks through natural language.

The chat is context-aware: it knows about all tasks, projects, triggers, and their states. Commands are safety-classified (T-009) before execution — read-only commands run immediately, mutating commands require user approval.

## Requirements

1. **Chat panel**: A slide-out or always-visible panel accessible from any view. Opening/closing should be fast and not disrupt the current view.

2. **Conversational LLM interaction**: The user types messages and receives streamed LLM responses. The chat maintains conversation history within the session.

3. **Project context awareness**: The LLM's system prompt includes a summary of all current tasks (titles, columns, projects, waiting states) and project information. This allows the user to ask questions like "what's the status of the auth refactor?" without specifying IDs.

4. **CLI command execution** (§7.1):
   - The LLM can decide to execute CLI commands as part of answering a question.
   - Commands are classified using the command safety module (T-009).
   - **Read-only commands**: Execute immediately, show output in the chat.
   - **Mutating commands**: Show the command to the user with a classification reason. User can approve, modify, or reject. On approval, execute and show output.

5. **Task management via chat**: The user can manage tasks through natural language:
   - "Move the auth refactor to In Progress"
   - "Create a new task for investigating the memory leak"
   - "What tasks are waiting on triggers?"
     These actions use the existing task/project IPC handlers.

6. **Message display**: Show messages with clear visual distinction between user messages, assistant messages, and command outputs. Commands should be displayed in a code block with the safety classification badge.

## Existing Code

- **LLM service**: T-002 provides streaming text generation
- **Command safety**: T-009 classifies commands
- **IPC handlers**: All task and project CRUD handlers exist
- **Layout**: `src/renderer/src/components/Layout.tsx` — add chat toggle button

## Implementation Notes

- **Component location**: Create `src/renderer/src/components/Chat/` directory with:
  - `ChatPanel.tsx` — the slide-out panel container
  - `ChatMessages.tsx` — message list with auto-scroll
  - `ChatInput.tsx` — text input with send button
  - `CommandApproval.tsx` — UI for approving/rejecting mutating commands
- **Streaming**: Use Vercel AI SDK's `useChat` hook (or equivalent) in the renderer. The actual LLM call happens in the main process via IPC — the renderer sends the message, the main process streams back tokens.
- **Agentic loop**: The LLM should have tool definitions for:
  - `executeCommand(command: string)` — run a CLI command
  - `listTasks(filters?)` — query tasks
  - `updateTask(id, changes)` — modify a task
  - `listProjects()` — query projects
    The main process handles tool calls: classify commands before execution, execute task/project operations directly.
- **Context injection**: On each conversation turn, fetch current task/project state and include it in the system prompt. Keep it concise — titles, columns, projects, waiting states. Don't include full context blocks (too long).
- **IPC channels**: Add `chat:sendMessage` (streams response back), `chat:approveCommand` (user approves a pending mutating command), `chat:rejectCommand`.
- **Conversation state**: Maintain conversation history in the main process (or pass it from the renderer on each turn). Clear on panel close or provide a "new conversation" button.
- **Panel position**: Right-side slide-out panel is conventional. Should overlap the main content, not push it.

## Testing Requirements

**Coverage target: 80% line coverage.**

### Renderer tests (jsdom Vitest project):

1. **Panel opens/closes**: Toggle button shows/hides the chat panel.
2. **Send message**: Type and send — verify message appears in the list and IPC is called.
3. **Receive streamed response**: Mock streaming IPC — verify tokens appear progressively.
4. **Command display**: Verify CLI commands render in code blocks with safety badges.
5. **Command approval flow**: Mutating command shows approval UI. Approve → command executes. Reject → command skipped.
6. **Task management**: Send "list all tasks" — verify task data appears in response.

### Main process tests (node Vitest project):

7. **Tool definitions**: Verify the LLM tool schema includes executeCommand, listTasks, etc.
8. **Command execution flow**: Read-only command → auto-execute. Mutating command → pause for approval.
9. **Context injection**: Verify system prompt includes current task/project summary.
10. **Conversation history**: Verify messages are tracked across turns.

## Documentation

- Add a section to `docs/ARCHITECTURE.md` describing the chat architecture: message flow, tool calling, command safety integration.

## Verification

1. Run `npm run test` — chat interface tests pass.
2. Run `npm run dev`:
   - Open the chat panel from Focus View.
   - Ask "what tasks do I have?" — verify it lists current tasks.
   - Ask "what's the status of PR #123 in org/repo?" — verify it runs `gh pr view` and shows results.
   - Ask "merge PR #123" — verify it shows the command for approval before executing.
   - Ask "move task X to In Progress" — verify the task moves.
