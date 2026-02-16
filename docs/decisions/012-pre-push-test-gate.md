# ADR 012: Pre-Push Test Gate for Local Agent Feedback

**Status:** Superseded by Claude Code stop hooks
**Date:** 2026-02-14
**Superseded:** 2026-02-16

## Context

The project is built primarily by AI agents running locally via Claude Code. These agents can observe Git hook output (pre-commit, pre-push) but do not monitor CI pipeline results after a push. Before this change, the only test enforcement was CI — meaning an agent could push broken code and never learn about the failure within its session.

The pre-commit hook (ADR 008) catches lint and type errors quickly, but tests and coverage were only enforced in CI. This left a gap: an agent could commit clean-compiling code that breaks tests, push it, and move on without feedback.

## Decision

Add a **pre-push hook** (`.husky/pre-push`) that runs `npm run test`, which includes:

- Full Vitest test suite (node + renderer projects)
- Coverage thresholds (80% overall, enforced by vitest config)
- Automatic `better-sqlite3` rebuild via the `pretest` lifecycle script (ADR 009)

This creates a 4-layer enforcement model:

1. **Pre-commit** — lint-staged + project-wide typecheck (~5-10s)
2. **Pre-push** — full test suite + coverage (~5-15s)
3. **CI** — same checks as layers 1-2, serving as audit trail and protection against hook bypass
4. **CLAUDE.md** — documents all layers so agents run checks proactively before hooks fire

### Why pre-push and not pre-commit?

Running the full test suite on every commit would add ~10-15s to each commit. During iterative development, agents often make several small commits before pushing. Pre-push is the right boundary: it catches failures before they reach the remote while keeping the commit cycle fast.

### Alternatives considered

- **CI-only enforcement:** Agents don't see CI results, so failures go unnoticed within the session. Defeats the purpose of fast feedback.
- **Pre-commit test runs:** Too slow for iterative commit workflows. Typecheck already catches most structural errors at commit time.
- **Manual `npm test` reminders in CLAUDE.md:** Process-based enforcement doesn't work reliably with agents (same rationale as ADR 008).

## Consequences

- **Agents get immediate test feedback** before code reaches the remote. A failing push stays local, and the agent can fix it in the same session.
- **Push takes ~5-15s longer** due to the test run. Acceptable given the correctness benefit and that pushes are less frequent than commits.
- **Hook bypass is still possible** (`--no-verify`), but CI catches it. The hook is a fast feedback loop, not a security boundary.
- **CI remains the authoritative gate** — the pre-push hook is a convenience layer that gives agents the same signal CI would, just sooner.

## Why Superseded

**Claude Code stop hooks** now provide test and lint feedback directly within the agent session. When stopping a task (exit or `Ctrl+C`), Claude Code runs the configured validation commands and shows results in context. This is superior to pre-push hooks because:

1. **Earlier feedback** — validation runs when stopping work, not just before pushing
2. **Better UX** — results appear in the agent's conversation, not just as hook output
3. **No push delay** — the ~5-15s test run no longer blocks git push
4. **Same guarantees** — CI still provides the authoritative gate

The pre-push hook was removed on 2026-02-16.
