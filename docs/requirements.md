# Claude Code Orchestrator — Requirements v3 (Final)

## Overview

A locally-hosted, single-process web application that orchestrates multiple Claude Code instances via tmux, providing a unified dashboard for managing agents across git repositories with optional GitHub/Azure DevOps integration.

## Core Concepts

**Project** — A git repository directory tracked in SQLite. Auto-detected from git remotes. Added by the user through the web UI ("open directory").

**Agent** — A Claude Code instance running in a tmux session, scoped to a project directory. May be linked to an issue or PR.

**Orchestrator** — A single Node.js process serving the React SPA, REST API, and WebSocket connections.

---

## Tech Stack

- **Runtime**: Node.js (TypeScript).
- **Backend/Frontend**: React Router in framework mode (use hono instead of express).
- **Storage**: SQLite via better-sqlite3 (or drizzle ORM).
- **IPC**: WebSocket for live conversation/status push. REST for CRUD and CLI queries.

---

## Phase 1 — Agent Dashboard & Lifecycle

### 1.1 Project Tracking

- No config file. Projects are stored in SQLite, added via the web UI ("Add Project" → directory picker / path input).
- On add, detect git remote and classify provider (stored for Phase 2). Directories without remotes are valid — just no provider integration.
- Projects can be removed (soft delete) from the dashboard.

### 1.2 Agent Lifecycle (tmux)

- **Launch**: Spawn `claude` in a named tmux session (`orch-{agent-id}`), cwd set to project directory. Accept optional initial prompt, sent after launch via `send-keys`.
- **Input**: Forward text to tmux via `send-keys`. Multi-line input uses `Alt+Enter` for newlines within Claude Code.
- **Screen Read**: Poll `tmux capture-pane -p` every ~2s per active agent. Parse output for status heuristics (active/idle/waiting for input).
- **Terminate**: Send `/exit` via `send-keys`, force-kill session after 5s timeout.
- **Reconnect on Startup**: On orchestrator start, scan for existing `orch-*` tmux sessions. Match against SQLite agent records by session name and re-adopt any that are still alive. Mark agents whose sessions are gone as terminated.

### 1.3 Conversation Log Rendering

- Auto-scan `~/.claude/projects/` to locate conversation logs. Match to projects by resolving the directory path hash Claude Code uses.
- Parse JSONL: user messages, assistant messages (markdown content), tool_use blocks (tool name, input, output), thinking blocks.
- Render as HTML:
  - Assistant messages: rendered markdown.
  - Tool calls: collapsible sections showing tool name, input summary, and result.
  - User messages: clearly delineated.
  - Thinking blocks: collapsible, dimmed.
- Live-tail via `fs.watch` with ~1s debounce. Push new messages to frontend over WebSocket.

### 1.4 Global Agent Dashboard

- All agents grouped by project directory.
- Agent card: status badge (active/idle/waiting/error/terminated), project name, last message snippet, duration since launch.
- Actions per agent: open detail, terminate, quick input.
- "New Agent" flow: select project → optional initial prompt → launch.
- "Add Project" flow: enter directory path → validate → store in SQLite.

### 1.5 Agent Detail View

- Full rendered conversation log, live-updating via WebSocket.
- Raw terminal view from tmux `capture-pane` (collapsible, secondary to conversation log).
- Input box: text area that sends to agent via `send-keys`. Supports multi-line (sends `Alt+Enter` between lines).
- Metadata: project name, directory, start time, linked issue/PR label (manual tagging for Phase 1).

### 1.6 SQLite Schema

```sql
-- Projects tracked by the user
CREATE TABLE projects (
  id            TEXT PRIMARY KEY,  -- ulid or uuid
  name          TEXT NOT NULL,     -- display name (defaults to repo/dir name)
  directory     TEXT NOT NULL UNIQUE,
  remote_url    TEXT,              -- nullable, from git remote
  provider_type TEXT,              -- 'github' | 'azure-devops' | null
  owner         TEXT,              -- extracted from remote
  repo          TEXT,              -- extracted from remote
  created_at    TEXT NOT NULL,
  removed_at    TEXT               -- soft delete
);

-- Agent instances
CREATE TABLE agents (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id),
  tmux_session    TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'starting',
  initial_prompt  TEXT,
  linked_issue_id TEXT,            -- manual in Phase 1, auto in Phase 2
  linked_pr_id    TEXT,            -- manual in Phase 1, auto in Phase 2
  log_path        TEXT,            -- resolved path to conversation JSONL
  created_at      TEXT NOT NULL,
  ended_at        TEXT
);
```

---

## Phase 2 — Project Integration

### 2.1 Git Remote Auto-Detection

- On project add, run `git -C {dir} remote get-url origin`.
- Parse remote URL to classify provider and extract owner/repo:
  - GitHub: `github.com/{owner}/{repo}`
  - Azure DevOps: `dev.azure.com/{org}/{project}/_git/{repo}` (and legacy `visualstudio.com` variants)

### 2.2 CLI Provider Abstraction

```typescript
interface ProjectProvider {
  type: "github" | "azure-devops";
  listIssues(filters?): Promise<Issue[]>;
  getIssue(id: string): Promise<IssueDetail>;
  listPRs(filters?): Promise<PullRequest[]>;
  getPR(id: string): Promise<PRDetail>;
  listBuilds(filters?): Promise<Build[]>;
}
```

- **GitHub**: `gh issue list --json`, `gh pr list --json`, `gh run list --json`, etc.
- **Azure DevOps**: `az boards work-item query`, `az repos pr list`, `az pipelines run list`, etc.
- All CLI calls use `--output json` / `--json` for structured parsing.
- Results cached briefly (30s–60s TTL) to avoid hammering CLIs on page loads.

### 2.3 Per-Project View

- **Issues tab**: Open issues from remote. "Launch agent on issue" pre-fills prompt with issue title, body, and link.
- **PRs tab**: Open PRs with status checks. "Launch review agent" action.
- **Builds tab**: Recent CI/pipeline runs with pass/fail/running status.
- **Agents tab**: Active and recent agents for this project, linking to detail views.

### 2.4 Dashboard Enhancements

- Agent cards show resolved project name and linked issue/PR title (fetched from provider).
- Group-by-project toggle on global dashboard.
- Agents launched from an issue/PR auto-populate `linked_issue_id` / `linked_pr_id`.

---

## Design System

### E-Ink & Mobile Optimization

- **No animations, transitions, or gradients.** Instant state changes only.
- **No colored background fills** on cards, rows, or sections. Use borders (1px solid) and whitespace for visual grouping.
- **Typography**: System font stack (`system-ui, -apple-system, sans-serif`). Minimum weight 400. Body text 16px minimum.
- **Tap targets**: Minimum 44×44px for all interactive elements.
- **Layout**: Mobile-first single column. Sidebar + main on screens ≥768px.

### Color Palette

All colors chosen for legibility on Kaleido 3 color e-ink and standard displays:

| Role        | Value     | Usage                        |
| ----------- | --------- | ---------------------------- |
| Text        | `#1a1a1a` | Body text, headings          |
| Secondary   | `#555555` | Timestamps, metadata, dimmed |
| Border      | `#cccccc` | Card borders, separators     |
| Background  | `#ffffff` | Page background              |
| Active      | `#2e7d32` | Muted green — active status  |
| Waiting     | `#f57f17` | Muted amber — waiting/idle   |
| Error       | `#c62828` | Muted red — error/terminated |
| Link/Action | `#1565c0` | Muted blue — links, buttons  |

### Syntax Highlighting

Custom e-ink-friendly theme for conversation log code blocks. Principle: differentiate by **weight and mild hue**, not vivid color.

| Token      | Style                            |
| ---------- | -------------------------------- |
| Keyword    | `#2e4057`, bold                  |
| String     | `#5b7553`                        |
| Comment    | `#777777`, italic                |
| Number     | `#8b5e3c`                        |
| Function   | `#1a1a1a`, bold                  |
| Operator   | `#555555`                        |
| Type       | `#4a6b8a`                        |
| Background | `#ffffff` (no tinted background) |

---

## Non-Functional

- Single-user, localhost only (no auth).
- macOS and Linux.
- Depends on system-installed: `tmux`, `claude`, and (Phase 2) `gh` and/or `az`.
- Single process: `node server.js` starts everything.
- Agents are ephemeral; conversation logs are the durable record.

## Out of Scope

- Multi-user / remote access / auth.
- Webhook-triggered agent launches.
- Cost tracking / token metering.
- File editing through the web UI.
- Config file (replaced by SQLite + UI).
