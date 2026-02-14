# ADR 005: Claude Code Hooks for Agent Notifications

**Status:** Accepted
**Date:** 2026-02-13

## Context

One key trigger type is "Claude Code agent session finishes." We need a mechanism to detect when agent sessions complete without polling.

## Decision

Use Claude Code's native hook system to receive event-driven notifications. The hook writes a sentinel file that the trigger's check script detects on its next poll:

1. The trigger's check script polls for a sentinel file at `~/.chaos-coordinator/triggers/trigger-<ID>.signal`.
2. A Claude Code hook creates this file when the relevant event occurs (e.g., agent session completes).
3. On the next poll, the check script finds the file, reads its contents as `firedContext`, removes the file, and exits 0.

Example Claude Code hook configuration:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": { "tool_name": "stop" },
        "command": "echo 'Agent session completed' > ~/.chaos-coordinator/triggers/trigger-42.signal"
      }
    ]
  }
}
```

Example check script:

```bash
FILE="$HOME/.chaos-coordinator/triggers/trigger-42.signal"
if [ -f "$FILE" ]; then
  cat "$FILE"
  rm "$FILE"
  exit 0
fi
exit 1
```

## Consequences

- **Event-driven via file sentinel:** The hook fires immediately on agent completion; the check script detects it on the next poll (at most 5 minutes later).
- **Native integration:** Uses Claude Code's built-in hook mechanism rather than a custom workaround.
- **No server required:** File-based signaling avoids the need for a local HTTP endpoint or IPC listener.
- **Dependency:** Requires Claude Code to be installed and configured with the appropriate hook. The hook setup should be documented and ideally automated.
- **Directory convention:** The `~/.chaos-coordinator/triggers/` directory must exist. The app should create it on startup.
