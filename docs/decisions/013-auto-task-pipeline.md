# ADR 013: Automated Task Pipeline via Claude Code CLI

**Status:** Accepted
**Date:** 2026-02-16

## Context

The project is built primarily by AI agents running via Claude Code. The manual workflow for implementing a task followed a consistent pattern:

1. Prompt the agent to implement the next task
2. Run lint and tests, feed errors back for fixes
3. Review the changes for correctness, edge cases, and consistency
4. Fix any issues found in review, re-validate

This cycle was repetitive and required constant human shepherding for what was essentially a mechanical process. Each step used the same prompting patterns, and the sequencing between steps was always the same. Encoding it as a script ensures the process runs consistently every time and frees up the developer to review the final output rather than babysit each phase.

## Decision

Add `scripts/auto-task.sh`, a bash pipeline that orchestrates Claude Code CLI invocations through a structured implement → validate → review → validate loop.

### Pipeline stages

1. **IMPLEMENT** — A Claude session reads the task doc, implements the feature (production code + tests), and updates the task frontmatter status (`ready` → `in-progress` → `review`).
2. **VALIDATE + FIX** — Runs `npm run lint` and `npm run test`. If either fails, the errors are piped via stdin to a new Claude session that fixes them. Retries up to a configurable limit (default: 3 attempts).
3. **REVIEW** — A separate Claude session (using a stronger model by default) reads `git diff`, reads the task spec, and reviews the changes for correctness, edge cases, type safety, test coverage, accessibility, and consistency. It fixes issues directly and signals approval via a sentinel string.
4. **POST-REVIEW VALIDATE + FIX** — Since the reviewer may have modified code, validation runs again with the same fix loop.

Steps 3–4 repeat up to a configurable number of review rounds (default: 2) if the reviewer doesn't approve.

### Key design choices

**Headless execution.** All Claude invocations use `-p` (prompt mode) with `--dangerously-skip-permissions` so the pipeline runs unattended. The script is intended for use in a trusted local environment where the developer reviews all changes before committing.

**Sentinel string protocol.** Phases communicate state via structured strings in their output: `NO_ELIGIBLE_TASK`, `DEPENDENCIES_NOT_MET`, `TASK_IMPLEMENTED: T-NNN`, and `CHANGES APPROVED`. This keeps the protocol simple and grep-parseable without requiring JSON output parsing.

**Stdin-piped error feeding.** The fix phase receives lint/test output via stdin rather than as part of the prompt string. This avoids shell quoting issues with large, multiline error output and keeps the prompt template clean.

**Separate review model.** The review phase defaults to a stronger model (`opus`) than the implement/fix phases (`sonnet`). The review prompt asks for higher-level reasoning about correctness and edge cases, which benefits from the stronger model. The implement/fix phases are more mechanical and run fine on the faster model.

**Task doc frontmatter integration.** The pipeline reads task status from frontmatter (`ready` → eligible) and updates it through the lifecycle (`in-progress` → `review`). The final `done` transition is left for the human to set after reviewing the changes, since the script deliberately does not commit.

**Changes left uncommitted.** The pipeline never commits or pushes. All changes are left in the working tree for developer review. This keeps the human in the loop for the final approval step and avoids any risk of pushing broken code.

### Alternatives considered

- **CI-based automation:** Running this pipeline in CI (triggered by task creation or schedule) is a likely future evolution. The process needs to be refined locally first — prompt tuning, fix loop reliability, and review quality all benefit from fast local iteration before moving to a slower CI feedback loop.
- **Single-pass without review:** The review phase proved too valuable to omit. The review prompt, especially on a stronger model, consistently catches edge cases, missing test scenarios, and consistency issues that the implementation pass misses. The cost of an extra Claude invocation is small compared to the bugs it prevents.

## Consequences

- **Tasks can be implemented end-to-end without human intervention** during the pipeline run. The developer's role shifts from shepherding each phase to reviewing the final diff.
- **Validation is enforced mechanically** — the pipeline won't proceed past a phase with failing lint or tests, preventing the "it compiles but doesn't pass" class of issues.
- **The review phase adds a meaningful quality gate** that catches issues the implementation phase misses, at the cost of one additional Claude session per run.
- **Pipeline runs are logged** to `logs/` with full Claude output for each phase, enabling post-hoc debugging of agent behavior.
- **All configuration is overridable** via CLI flags and environment variables, allowing tuning without modifying the script.
- **The script assumes a trusted local environment** — `--dangerously-skip-permissions` should not be used in shared or CI environments without additional sandboxing.
