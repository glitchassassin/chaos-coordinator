---
id: T-009
title: 'Command Safety Classification'
status: ready
priority: 4
dependencies: ['T-002']
spec_refs: ['§7.2']
adrs: ['003']
estimated_complexity: M
tags: [core, safety]
created: 2026-02-14
updated: 2026-02-14
---

# T-009: Command Safety Classification

## Context

Both the trigger system (T-010) and chat interface (T-011) execute CLI commands. All commands must be classified as read-only or potentially mutating before execution. Read-only commands execute immediately; mutating commands require user approval.

ADR 003 specifies: allowlist of known safe commands, with LLM fallback for unknowns. The default for unknowns is "mutating" (require approval). Background trigger agents are restricted to read-only commands only.

This is critical-path safety logic with a 90%+ test coverage requirement (ADR 008).

## Requirements

1. **Allowlist of known read-only commands**: Maintain a list of command patterns that are definitively safe. Examples:
   - `gh issue view`, `gh pr view`, `gh pr status`, `gh pr checks`, `gh api` (GET)
   - `az boards work-item show`, `az pipelines runs list`, `az pipelines runs show`
   - `git log`, `git status`, `git diff`, `git show`, `git branch --list`
   - `claude` (status checks)
   - General: `cat`, `ls`, `head`, `tail`, `echo`, `date`, `which`, `type`

2. **Blocklist of known mutating commands**: A list of command patterns that are always mutating:
   - `gh pr merge`, `gh pr close`, `gh issue close`, `gh pr edit`
   - `git push`, `git commit`, `git reset`, `git checkout`, `git branch -d`
   - `rm`, `mv`, `cp` (to certain locations), `chmod`, `chown`
   - Any command with `>` (output redirection), `|` to a mutating command

3. **LLM fallback**: For commands not in either list, classify using the LLM (T-002). The prompt should explain the command and ask for a classification with reasoning. Default to "mutating" if the LLM is uncertain or unavailable.

4. **Classification API**: Expose a function `classifyCommand(command: string): Promise<{ safety: 'read_only' | 'mutating', reason: string, source: 'allowlist' | 'blocklist' | 'llm' }>`.

5. **Trigger restriction**: The trigger system must ONLY execute commands classified as `read_only`. If a trigger needs a mutating command, it should fail with a clear error.

6. **Chat approval flow**: For the chat interface, mutating commands are shown to the user with the command text and classification reason. The user can approve, modify, or reject.

## Existing Code

- **Shared types**: `src/shared/types/enums.ts` — `CommandSafety` enum already exists (`ReadOnly`, `PotentiallyMutating`, `Unknown`)
- **ADR 003**: `docs/decisions/003-command-safety.md` — detailed design rationale
- **LLM service**: T-002 provides classification via structured output

## Implementation Notes

- **Module location**: Create `src/main/safety/` directory with:
  - `allowlist.ts` — read-only command patterns (regex or prefix matching)
  - `blocklist.ts` — mutating command patterns
  - `classifier.ts` — main classification function that checks allowlist → blocklist → LLM fallback
  - `index.ts` — public API
- **Pattern matching**: Commands should be parsed to extract the base command and key arguments. Don't just string-match the full command — parse it enough to identify the command name and critical flags.
  - E.g., `gh pr view 123 --json title` → base: `gh`, subcommand: `pr view`, flags: `--json`
  - E.g., `git log --oneline -n 10` → base: `git`, subcommand: `log`
- **Pipe and chain handling**: Commands with `|`, `&&`, `||`, or `;` should be split and each part classified independently. The overall classification is the most restrictive (if any part is mutating, the whole thing is mutating).
- **LLM prompt**: "Classify the following shell command as 'read_only' (inspects state only, changes nothing) or 'mutating' (may change files, remote state, or system state). Command: `[cmd]`. Respond with the classification and a one-sentence reason."
- **Caching**: Consider caching LLM classification results for repeated command patterns to reduce latency and API calls.

## Testing Requirements

**Coverage target: 90%+ line coverage** (critical safety logic per ADR 008).

Test in the `node` Vitest project.

1. **Allowlist matches**: Test each category of known read-only commands.
2. **Blocklist matches**: Test each category of known mutating commands.
3. **Flag sensitivity**: `git branch --list` is read-only, `git branch -d` is mutating.
4. **Pipe handling**: `gh pr view 123 | cat` is read-only. `echo "data" > file.txt` is mutating.
5. **Chain handling**: `git status && git push` is mutating (due to `git push`).
6. **LLM fallback**: Mock LLM to return classification for unknown commands.
7. **LLM unavailable**: When LLM fails, default to mutating.
8. **Ambiguous commands**: Test edge cases like `curl` (read-only GET vs. mutating POST).
9. **Source tracking**: Verify the `source` field correctly reports allowlist/blocklist/llm.
10. **Empty/invalid commands**: Handle gracefully.

## Documentation

- Add a section to `docs/ARCHITECTURE.md` describing the command safety system.
- Document how to extend the allowlist/blocklist in `docs/references/` for future maintainers.

## Verification

1. Run `npm run test` — safety classification tests pass with 90%+ coverage on `src/main/safety/`.
2. Manually verify by importing the classifier in a test script and checking:
   - `gh pr view 123` → read_only (allowlist)
   - `git push origin main` → mutating (blocklist)
   - A novel command → mutating (LLM fallback or default)
