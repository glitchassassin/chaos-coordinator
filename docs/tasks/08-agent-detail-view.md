# Task 08 — Agent Detail View

## Goal

Build the agent detail page with live conversation log, raw terminal view, input box, and metadata.

## Subtasks

### Route & Layout

- [ ] Route: `/agents/:id` → detail view
- [ ] React Router loader fetches agent record + initial conversation log + latest terminal output

### Conversation Log Panel (primary)

- [ ] Render full parsed conversation log (from Task 06 frontend components)
- [ ] Auto-scroll to bottom on new messages
- [ ] Live-update via WebSocket as new messages arrive

### Raw Terminal Panel (secondary)

- [ ] Collapsible panel showing latest `capture-pane` output
- [ ] Monospace font, preserves whitespace/ANSI layout
- [ ] Updates via WebSocket (or polls on expand)

### Input Box

- [ ] Text area at bottom of view
- [ ] Submit sends text to agent via `POST /agents/:id/input`
- [ ] Multi-line support: Enter submits, Shift+Enter for newlines (or similar UX)
- [ ] Disabled when agent is terminated

### Metadata Header

- [ ] Project name + directory
- [ ] Start time
- [ ] Current status badge
- [ ] Linked issue/PR label (text input for manual tagging in Phase 1)
- [ ] Terminate button

## Acceptance

- Navigating to an agent shows its full conversation history
- New messages appear in real-time
- Can send input and see it reflected in the conversation
- Raw terminal view shows current tmux pane state
- Metadata is accurate and status updates live

## References

- Requirements: §1.5
