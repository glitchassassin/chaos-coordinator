---
id: T-011a
title: 'Chat Panel + Conversational LLM'
status: ready
priority: 4
dependencies: ['T-002']
spec_refs: ['§7.1']
adrs: []
estimated_complexity: M
tags: [ui, llm]
created: 2026-02-16
updated: 2026-02-16
---

# T-011a: Chat Panel + Conversational LLM

## Context

The chat panel provides a conversational interface to the system, available from any view. This task builds the panel UI and the conversational LLM integration — the user can ask questions and get context-aware responses about their tasks and projects.

Split from T-011 (Chat Interface). See T-011b for agentic CLI execution and task management via chat.

## Requirements

1. **Chat panel**: A right-side slide-out panel accessible from any view via a toggle button in the layout header. Opening/closing should be fast (CSS transition) and not disrupt the current view content.

2. **Message input**: A text input at the bottom of the panel with a send button. Enter submits, Shift+Enter for newlines.

3. **Streaming LLM responses**: User messages are sent to the LLM via IPC. Responses stream back token-by-token and display progressively. The chat maintains conversation history within the session.

4. **Project context awareness**: The LLM's system prompt includes a summary of all current tasks (titles, columns, projects, trigger/waiting states) and project information. This allows questions like "what's the status of the auth refactor?" without specifying IDs.

5. **Message display**: Clear visual distinction between:
   - User messages (right-aligned or distinct background)
   - Assistant messages (left-aligned, different background)
   - Auto-scroll to newest message, but don't scroll if the user has scrolled up

6. **Conversation management**:
   - History maintained in session (cleared on panel close or via "New Conversation" button)
   - Messages passed to the main process on each turn for LLM context

7. **Keyboard accessible**: Toggle button focusable, input field auto-focused on open, Escape closes the panel.

## Existing Code

- **LLM service**: T-002 provides streaming text generation
- **Layout**: `src/renderer/src/components/Layout.tsx` — add chat toggle button
- **Preload API**: `window.api.*` for task/project data

## Implementation Notes

- **Component structure**: Create `src/renderer/src/components/Chat/` directory:
  - `ChatPanel.tsx` — slide-out container with open/close animation
  - `ChatMessages.tsx` — scrollable message list with auto-scroll
  - `ChatInput.tsx` — text input with send button
- **IPC channels**: Add `chat:sendMessage` that accepts `{ messages: ChatMessage[], context: TaskProjectSummary }` and streams response tokens back via IPC events.
- **Streaming**: Main process calls LLM with streaming enabled, sends each chunk via `webContents.send('chat:token', chunk)`. Renderer accumulates chunks into the current assistant message.
- **Context injection**: Before each turn, fetch current task/project state and include it as a system prompt. Keep it concise — titles, columns, projects, waiting states. Don't include full context blocks.
- **Panel state**: Manage open/closed state in the Layout component. Use CSS `transform: translateX()` for the slide animation.
- **Auto-scroll**: Use a ref to the message container. Scroll to bottom on new content unless the user has scrolled up (detect by checking if scrollTop + clientHeight < scrollHeight).

## Testing Requirements

**Coverage target: 80% line coverage.**

### Renderer tests (jsdom Vitest project):

1. **Panel opens/closes**: Toggle button shows/hides the chat panel.
2. **Send message**: Type and send — verify message appears in the list and IPC is called.
3. **Receive streamed response**: Mock streaming IPC — verify tokens appear progressively in the assistant message.
4. **Context-aware system prompt**: Verify the IPC call includes task/project summary.
5. **Conversation history**: Send multiple messages — verify history is maintained across turns.
6. **New conversation**: Click "New Conversation" — verify history clears.
7. **Keyboard**: Verify Enter submits, Escape closes, input auto-focuses on open.

### Main process tests (node Vitest project):

8. **Chat handler**: Verify `chat:sendMessage` calls LLM with messages and system prompt.
9. **Streaming**: Verify tokens are sent back via IPC events.
10. **Context building**: Verify system prompt includes current task/project state.

## Verification

1. Run `npm run test` — chat panel tests pass.
2. Run `npm run dev`:
   - Open the chat panel from any view.
   - Ask "what tasks do I have?" — verify a streamed response listing current tasks.
   - Ask a follow-up question — verify conversation context is maintained.
   - Close and reopen — verify conversation resets.
   - Verify the panel doesn't disrupt the underlying view.
