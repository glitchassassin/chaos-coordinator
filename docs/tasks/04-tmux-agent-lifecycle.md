# Task 04 — Tmux Agent Lifecycle

## Goal

Implement the core agent lifecycle: launch, input, screen read, terminate, and reconnect — all via tmux.

## Subtasks

### Tmux Service Layer

- [ ] `launchAgent(projectId, initialPrompt?)`:
  - Generate agent ID (ULID)
  - Create tmux session: `tmux new-session -d -s orch-{id} -c {projectDir} claude`
  - If `initialPrompt` provided, send via `tmux send-keys -t orch-{id} '{prompt}' Enter`
  - Insert agent record (status: `starting`)
- [ ] `sendInput(agentId, text)`:
  - For multi-line: split on newlines, join with `Alt+Enter` (`send-keys -l` with escape sequences)
  - Send to tmux session via `send-keys`
- [ ] `capturePane(agentId)`:
  - Run `tmux capture-pane -t orch-{id} -p`
  - Return raw terminal output
- [ ] `terminateAgent(agentId)`:
  - Send `/exit` via `send-keys`
  - After 5s timeout, force-kill: `tmux kill-session -t orch-{id}`
  - Update agent record: status `terminated`, set `ended_at`
- [ ] `reconnectAgents()` (called on server startup):
  - List existing `orch-*` sessions: `tmux list-sessions -F '#{session_name}'`
  - Match against agent records in SQLite
  - Re-adopt live sessions, mark missing ones as terminated

### Status Polling

- [ ] Background polling loop (~2s interval per active agent)
- [ ] Parse `capture-pane` output for status heuristics:
  - Active: output changing between polls
  - Idle: output stable, prompt visible
  - Waiting for input: Claude Code's input prompt detected
  - Error: error patterns detected
- [ ] Update agent status in SQLite on change
- [ ] Push status changes to frontend via WebSocket

### REST API

- [ ] `POST /agents` — launch new agent
- [ ] `GET /agents` — list all agents (with project info)
- [ ] `GET /agents/:id` — agent detail
- [ ] `POST /agents/:id/input` — send input
- [ ] `POST /agents/:id/terminate` — terminate
- [ ] `GET /agents/:id/terminal` — latest capture-pane output

### Tests

- [ ] Unit tests for tmux command construction (mock `child_process`)
- [ ] Unit tests for status parsing heuristics
- [ ] Unit tests for reconnect logic

## Acceptance

- Can launch a Claude Code agent from the API, send it input, read terminal output, and terminate it
- Status polling detects active/idle/waiting states
- On server restart, existing tmux sessions are re-adopted

## References

- Requirements: §1.2
