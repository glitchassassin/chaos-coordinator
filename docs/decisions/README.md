# Technical Decision Log

This directory contains Architecture Decision Records (ADRs) documenting significant technical choices made in the project.

**Before proposing an alternative to a decision recorded here, read the original ADR to understand the context and trade-offs that were considered.**

## Decisions

| #   | Decision                                                                       | Status     |
| --- | ------------------------------------------------------------------------------ | ---------- |
| 001 | [Use Electron as desktop framework](001-electron-framework.md)                 | Accepted   |
| 002 | [Configurable LLM provider via Vercel AI SDK](002-llm-provider.md)             | Superseded |
| 003 | [Command safety: allowlist + LLM fallback](003-command-safety.md)              | Accepted   |
| 004 | [SQLite via better-sqlite3 for storage](004-sqlite-storage.md)                 | Accepted   |
| 005 | [Claude Code hooks for agent notifications](005-claude-code-hooks.md)          | Accepted   |
| 006 | [In-process timers for trigger scheduling](006-trigger-scheduling.md)          | Accepted   |
| 007 | [Build Focus View layout iteratively](007-focus-view-layout.md)                | Accepted   |
| 008 | [Code quality and testing standards](008-code-quality-standards.md)            | Accepted   |
| 009 | [Automatic native module rebuild for tests](009-native-module-test-rebuild.md) | Accepted   |
| 010 | [OpenRouter as default LLM provider](010-openrouter-default-provider.md)       | Accepted   |
| 011 | [Schema-driven configuration system](011-configuration-system.md)              | Accepted   |

## Format

Each ADR follows this structure:

- **Status:** Accepted / Superseded / Deprecated
- **Context:** What situation prompted this decision
- **Decision:** What we chose
- **Consequences:** What follows from this choice (positive and negative)
