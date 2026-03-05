# TODO

## 1. Questions Interface

Handle `question.asked`, `question.replied`, and `question.rejected` SSE events. When the AI asks a question, surface it to the user (similar to the permissions banner) and allow them to reply or reject via `POST /question/:requestID/reply` and `POST /question/:requestID/reject`.

## 2. Session Forking & Reverting

### Forking
Add a fork action on messages — calls `POST /session/:sessionID/fork` with the target message ID to branch the conversation at that point.

### Reverting (subset)
Add revert/unrevert actions on messages — calls `POST /session/:sessionID/revert` and `POST /session/:sessionID/unrevert` to roll back or restore a message and its effects.

## 3. @ File/Symbol Mention Autocomplete

When the user types `@` in the message input, open an autocomplete popover that searches:
- Files by name via `GET /file/find/file`
- Symbols via `GET /file/find/symbol`
- Text patterns via `GET /file/find`

Selecting a result inserts a file reference into the message. This is not a replacement for the file browser — it's a quick inline reference mechanism.

## 4. Session Todos

Fetch and display the per-session todo list via `GET /session/:sessionID/todo`. Handle `session.updated` to refresh when todos change. Display as a collapsible panel or sidebar section alongside the session.
