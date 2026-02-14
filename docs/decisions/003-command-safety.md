# ADR 003: Command Safety Classification via Allowlist + LLM Fallback

**Status:** Accepted
**Date:** 2026-02-13

## Context

The chat interface and trigger agents execute CLI commands. Mutating commands (e.g., `gh pr merge`, `git push`) must require user approval. Read-only commands (e.g., `gh pr view`, `git log`) should execute without friction.

The classification approach needs to be both predictable for common cases and handle novel commands gracefully.

## Decision

Maintain an allowlist of known read-only commands and subcommands. Commands not on the allowlist are classified by the LLM, defaulting to "mutating" (requires user approval) if uncertain.

## Consequences

- **Predictable:** Common read-only commands (`gh pr view`, `git log`, `az pipelines runs list`) are always fast-pathed without LLM latency.
- **Safe default:** Unknown commands default to requiring approval. Errs on the side of caution.
- **Extensible:** New CLI tools can be added to the allowlist over time.
- **LLM dependency:** Novel commands require an LLM call for classification, adding latency. Acceptable since these are uncommon.
