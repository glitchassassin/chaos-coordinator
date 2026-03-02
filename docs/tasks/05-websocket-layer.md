# Task 05 — WebSocket Layer

## Goal

Set up WebSocket support on Hono for real-time push of agent status changes, conversation log updates, and terminal output.

## Subtasks

- [ ] Configure WebSocket upgrade on Hono (`hono/ws` or `@hono/node-ws`)
- [ ] Define message protocol (JSON):
  - `agent:status` — status change for an agent
  - `agent:terminal` — new capture-pane output
  - `conversation:messages` — new conversation log entries
- [ ] Server-side event bus (simple EventEmitter or similar):
  - Tmux poller emits status and terminal events
  - Conversation log watcher emits message events
  - WebSocket handler subscribes and forwards to connected clients
- [ ] Client subscribes on connect, filters by agent ID on detail views
- [ ] Handle connection lifecycle: reconnect on drop, clean up subscriptions on disconnect
- [ ] Unit tests for message serialization and event routing

## Acceptance

- Frontend receives real-time agent status updates without polling
- Frontend receives new conversation messages as they appear
- Connections are cleaned up properly on disconnect

## References

- Requirements: Tech Stack (IPC), §1.3 (live-tail push), §1.5 (live-updating)
