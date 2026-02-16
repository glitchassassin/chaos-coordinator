# ADR 014: Intelligent Stop Hooks for Quality Gates

**Status:** Accepted
**Date:** 2026-02-16

## Context

AI agents building code through Claude Code need fast, contextual feedback on code quality without disrupting their workflow. Before this change, quality enforcement relied on:

1. **Pre-commit hooks** (ADR 008) — Run lint-staged + typecheck on `git commit`
2. **Pre-push hooks** (ADR 012, now superseded) — Run full test suite on `git push`
3. **CI checks** — Final gate on PRs to `main`

While pre-push hooks caught issues before they reached the remote, they had limitations:

- **Feedback timing:** Only ran when pushing, not when stopping work. Agents completing a task might exit without pushing, missing validation entirely.
- **No code review:** Hooks ran automated checks but didn't verify implementation correctness, adherence to spec, or code quality beyond what linters catch.
- **Push delay:** Full test suite added ~5-15s to every `git push`, even for quick pushes during iteration.

## Decision

Replace pre-push hooks with **intelligent stop hooks** that run when the agent exits or stops a task. The stop hooks system has two layers:

### 1. Automated Validation Hook

Runs `npm run lint` and `npm run test` to verify code quality and correctness. This catches the same issues as the pre-push hook but runs earlier (on task exit) and provides feedback within the agent session.

```json
{
  "type": "agent",
  "prompt": "Verify that npm run lint and npm test pass. $ARGUMENTS",
  "timeout": 120
}
```

### 2. Code Review Hook

Intelligently triggers the `code-reviewer` subagent when appropriate. This hook checks:

- Are there uncommitted changes?
- Is the task complete?
- Has code-reviewer already been invoked?

If changes exist, the task is done, and code-reviewer hasn't run, it launches automatically.

```json
{
  "type": "agent",
  "prompt": "If changes have been made and the task is complete, check if code-reviewer subagent has been invoked. If not, run it.",
  "timeout": 600
}
```

The `code-reviewer` agent (defined in `.claude/agents/code-reviewer.md`) is a specialized Opus-powered agent that reviews all uncommitted changes against six criteria:

1. **Correctness** — Matches spec, handles edge cases, logic is sound
2. **Code Quality** — Clean, maintainable, no dead code or debugging artifacts
3. **Type Safety** — Strict mode compliance, proper type narrowing, no unexplained `any`
4. **Test Coverage** — Happy paths, edge cases, error scenarios covered; 80%+ overall, 90%+ for critical logic
5. **Accessibility** — Keyboard navigation, ARIA labels, focus management, proper component usage
6. **Consistency** — Follows established patterns, matches codebase conventions

It produces a structured review report with blocking issues, suggestions, and criterion-by-criterion assessment.

## Configuration

Stop hooks are defined in `.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "agent",
            "prompt": "Verify that npm run lint and npm test pass. $ARGUMENTS",
            "timeout": 120
          },
          {
            "type": "agent",
            "prompt": "If changes have been made and the task is complete, check if code-reviewer subagent has been invoked. If not, run it.",
            "timeout": 600
          }
        ]
      }
    ]
  }
}
```

## Alternatives Considered

### Pre-push hooks only (ADR 012)

**Rejected:** Only runs on push, not on task exit. Agents completing work without pushing miss validation. No code review beyond automated checks.

### Manual code review reminders in CLAUDE.md

**Rejected:** Process-based enforcement doesn't work reliably with agents. Agents can forget or skip manual steps. Hooks guarantee execution.

### CI-only enforcement

**Rejected:** Agents don't observe CI results within their session. Feedback loop is too slow (happens after push, in separate system). Defeats the purpose of fast, local validation.

### Pre-commit code review

**Rejected:** Too slow for iterative development. Agents often make multiple small commits during feature work. Code review should happen when a logical unit of work is complete, not on every commit.

## Consequences

### Positive

- **Earlier feedback:** Validation runs when stopping work, not just before pushing. Catches issues in context while the agent session is still active.
- **Intelligent code review:** The code-reviewer agent provides deep, contextual analysis beyond what linters and tests catch. Reviews correctness, spec adherence, maintainability, and accessibility.
- **No push delay:** Removing the pre-push hook eliminates the ~5-15s test run on every `git push`. Tests still run, just at a better time (task exit).
- **Session-scoped feedback:** All hook results appear in the agent's conversation. The agent can immediately fix issues without context switching.
- **Selective invocation:** Code-reviewer only runs when needed (changes exist + task complete + not already invoked). Avoids redundant reviews.
- **Opus-powered depth:** Code-reviewer uses Opus for thorough, principal-engineer-level analysis. Worth the token cost for quality gates.

### Negative

- **Exit delay:** Stopping work takes longer due to validation and potential code review. Acceptable trade-off for quality, and only happens when exiting (not during normal workflow).
- **Requires Claude Code:** These hooks are Claude Code-specific. Other environments (manual development, CI) rely on pre-commit hooks and CI checks.
- **Hook bypass possible:** Agents can still force-exit or skip hooks. CI remains the authoritative gate. Stop hooks are a convenience layer for fast feedback, not a security boundary.

### Enforcement Model

The project now has a **3-layer enforcement model**:

1. **Pre-commit hook** — lint-staged + project-wide typecheck (~5-10s on commit)
2. **Stop hooks** — lint + tests + intelligent code review (~2-10min on task exit)
3. **CI** — lint + typecheck + tests on PRs (final gate + audit trail)

Each layer provides progressively deeper validation at appropriate workflow boundaries. Pre-commit catches quick syntax/type errors. Stop hooks validate completed work. CI provides authoritative enforcement and audit trail.

## Related Decisions

- **ADR 008:** Established code quality standards and pre-commit hook
- **ADR 012:** Pre-push test gate (superseded by this decision)
- **ADR 005:** Claude Code hooks for event-driven notifications (established hook foundation)
