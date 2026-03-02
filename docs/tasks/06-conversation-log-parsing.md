# Task 06 — Conversation Log Parsing & Live-Tail

## Goal

Locate, parse, and live-tail Claude Code conversation logs. Push parsed messages to the frontend.

## Subtasks

### Log Discovery

- [ ] Scan `~/.claude/projects/` directory structure
- [ ] Understand and replicate Claude Code's directory-path-to-hash mapping to match log directories to project paths
- [ ] Resolve `log_path` for an agent's project and store it on the agent record

### JSONL Parser

- [ ] Parse conversation JSONL files, extracting:
  - User messages (text content)
  - Assistant messages (markdown content blocks)
  - Tool use blocks: tool name, input summary, output/result
  - Thinking blocks (content)
- [ ] Handle malformed lines gracefully (skip with warning)
- [ ] Unit tests with sample JSONL fixtures covering all message types

### Live-Tail

- [ ] Watch log files via `fs.watch` with ~1s debounce
- [ ] Track file offset to only parse new lines on change
- [ ] Emit new messages to the event bus (consumed by WebSocket layer, Task 05)

### Frontend Rendering

- [ ] Assistant messages: render markdown to HTML (use a lightweight markdown renderer)
- [ ] Tool calls: collapsible section — tool name header, expandable input summary + result
- [ ] User messages: visually distinct block
- [ ] Thinking blocks: collapsible, dimmed styling
- [ ] Code blocks: apply syntax highlighting theme from design system (Task 01)

## Acceptance

- Given a project directory, the system finds and parses its conversation log
- New messages appended to the log appear in the frontend within ~2s
- All message types render correctly per the requirements

## References

- Requirements: §1.3
