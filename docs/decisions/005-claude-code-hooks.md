# ADR 005: Claude Code Hooks for Agent Notifications

**Status:** Accepted
**Date:** 2026-02-13

## Context

One key trigger type is "Claude Code agent session finishes." We need a mechanism to detect when agent sessions complete without polling.

## Decision

Use Claude Code's native hook system to receive event-driven notifications. The hook fires a shell command that notifies Chaos Coordinator directly (e.g., via local HTTP endpoint or IPC).

## Consequences

- **Event-driven:** No polling required for agent completion — immediate notification.
- **Native integration:** Uses Claude Code's built-in mechanism rather than a custom workaround.
- **Dependency:** Requires Claude Code to be installed and configured with the appropriate hook. The hook setup should be documented and ideally automated.
