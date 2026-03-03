# Chaos Coordinator (archived)

A locally-hosted web app for orchestrating multiple Claude Code instances via tmux. Built with React Router v7, Hono, SQLite, and WebSocket.

**Development on this project has been discontinued.**

## Why we stopped

Chaos Coordinator controlled Claude Code by launching CLI instances inside tmux panes, sending input via `tmux send-keys`, and reading output via `tmux capture-pane`. This works for demos but breaks down in practice due to fundamental constraints in the Claude Code CLI's terminal interface.

### No way to handle approval prompts

Claude Code prompts the user for permission before running tools (shell commands, file writes, etc.). There is no stable, machine-readable interface for detecting these prompts or responding to them programmatically. Every open-source orchestrator we surveyed uses one of these workarounds:

- **`--dangerously-skip-permissions`** — Disables all safety checks. Used by [claude_code_agent_farm](https://github.com/Dicklesworthstone/claude_code_agent_farm), [tmux-claude-mcp-server](https://github.com/michael-abdo/tmux-claude-mcp-server), and others.
- **Blind keystroke injection** — Send Down+Enter after a fixed delay and hope the dialog is in the expected state. Fragile and unsafe.
- **Pre-populated allow lists** — [IttyBitty](https://adamwulf.me/2026/01/itty-bitty-ai-agent-orchestrator/) writes `settings.local.json` with permitted tools and uses hooks to enforce path boundaries. The most principled approach, but still can't surface unanticipated prompts to a remote user.

None of these are acceptable for a tool meant to give users visibility and control over what their agents are doing.

### No reliable way to correlate sessions with conversation state

Claude Code's internal state (conversation history, tool calls, token usage) lives in JSONL files under `~/.claude/projects/`. But:

- There is no stable API for mapping a running CLI process to its conversation log file.
- The JSONL schema is undocumented and changes between versions.
- Every orchestrator we surveyed ignores these files entirely and instead maintains a parallel state store (JSON file, SQLite, or in-memory dict), reconstructing conversation content by parsing terminal output — which is lossy and version-fragile.

### Terminal output parsing is inherently brittle

Claude Code renders a rich TUI with Unicode box-drawing characters, spinner animations, and ANSI escape codes. Extracting structured information from `tmux capture-pane` output requires pattern-matching on characters like `●`, `⏺`, `╭`, `╰`, and `>` — all of which are implementation details that can change without notice. Projects that do this (like tmux-claude-mcp-server's `KeywordMonitor`) require constant maintenance.

## What would change our mind

- A first-party Claude Code SDK or subprocess protocol (structured JSON over stdio rather than a TUI)
- Stable, documented hooks for permission requests that include enough context to render a remote approval UI
- A supported way to map a running instance to its conversation log

The [Claude Code hooks system](https://docs.anthropic.com/en/docs/claude-code/hooks) (`PreToolUse`, `PostToolUse`, `Stop`, etc.) is a step in the right direction, and [Overstory](https://github.com/jayminwest/overstory) demonstrates a hook-driven architecture that avoids terminal parsing. But hooks alone don't solve the approval prompt problem — they fire shell commands, not interactive dialogs.

## Tech stack

- React Router v7 (framework mode) + Hono
- SQLite via better-sqlite3 + Drizzle
- WebSocket for live updates
- tmux for process management
- Tailwind CSS

## See also

Projects in this space, for reference:

- [claude_code_agent_farm](https://github.com/Dicklesworthstone/claude_code_agent_farm) — 20+ parallel agents, tmux monitoring
- [overstory](https://github.com/jayminwest/overstory) — Hook-driven orchestration, SQLite mail, git worktrees
- [tmux-claude-mcp-server](https://github.com/michael-abdo/tmux-claude-mcp-server) — MCP server for hierarchical instances
- [Tmux-Orchestrator](https://github.com/Jedward23/Tmux-Orchestrator) — Autonomous agent scheduling
- [ntm](https://github.com/Dicklesworthstone/ntm) — TUI for tiling AI agents in tmux
- [codex-orchestrator](https://github.com/kingbootoshi/codex-orchestrator) — tmux-based Codex/Claude delegation
- [IttyBitty](https://adamwulf.me/2026/01/itty-bitty-ai-agent-orchestrator/) — Minimal orchestrator with permission hooks
