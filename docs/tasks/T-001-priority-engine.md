---
id: T-001
title: 'Implement Priority Engine'
status: ready
priority: 1
dependencies: []
spec_refs: ['§3.1', '§3.2']
adrs: ['008']
estimated_complexity: M
tags: [core, business-logic]
created: 2026-02-14
updated: 2026-02-14
---

# T-001: Implement Priority Engine

## Context

The priority engine is the core decision-maker of Chaos Coordinator. It answers "what should I do right now?" by evaluating all active tasks against a hardcoded rule set and returning the single highest-priority actionable task for the Focus View.

Currently, the `tasks:focus` IPC handler (`src/main/ipc/tasks.ts`) returns a minimal stub — it just picks the first non-archived, non-backlog task sorted by `lastTouchedAt`. This task replaces that stub with the full priority algorithm from the spec.

This is critical-path business logic with a 90%+ test coverage requirement (ADR 008).

## Requirements

1. **Implement the full priority rule set** (§3.1), evaluated in this order of precedence:
   - **Column position**: review > in_progress > planning > backlog. Tasks further right always outrank tasks further left.
   - **Trigger recency**: Within the same column, tasks whose trigger fired recently outrank tasks without a recent trigger. "Recently" means the trigger's `firedAt` timestamp — more recent = higher priority.
   - **Project rank**: Within the same column and trigger state, tasks belonging to higher-ranked projects (lower `priorityRank` number = higher priority) take precedence.
   - **Last touched**: Within the same column, project rank, and trigger state, the most recently `lastTouchedAt` task gets a tiebreaker boost.
   - **Time in queue**: All else equal, tasks waiting longer (earlier `createdAt`) bubble up to prevent starvation.

2. **Enforce actionability rules** (§3.2):
   - A task is **not actionable** if it has an active trigger in `pending` or `polling` status (i.e., it's waiting on something).
   - A task in the `backlog` column is **never actionable** for Focus View — backlog tasks only appear in Board View.
   - Only tasks in `planning`, `in_progress`, or `review` columns with no active waiting trigger are candidates.

3. **Return type**: The focus query should return the single highest-priority task, or `null` if no tasks are actionable. Include the task's project data and trigger info (if recently fired) in the response.

4. **Expose a queue depth count**: Return alongside the focus task a summary of queue state — total actionable tasks, total waiting/blocked tasks — for the ambient queue indicator in Focus View.

## Existing Code

- **IPC handler to replace**: `src/main/ipc/tasks.ts` — the `tasks:focus` handler
- **Database schema**: `src/main/db/schema/tasks.ts`, `src/main/db/schema/triggers.ts`, `src/main/db/schema/projects.ts`
- **Shared types**: `src/shared/types/models.ts` (Task, Project, Trigger interfaces), `src/shared/types/enums.ts` (TaskColumn, TriggerStatus)
- **IPC type map**: `src/shared/types/ipc.ts` — update the return type for `tasks:focus`
- **Test helper**: `src/main/__tests__/helpers/mock-db.ts` — in-memory SQLite for tests

## Implementation Notes

- **Extract into its own module**: Create `src/main/priority/engine.ts` (or similar) with a pure function that takes a Drizzle database instance and returns the prioritized result. Keep it separate from the IPC handler for testability.
- **SQL vs. application logic**: The priority rules involve joins across `tasks`, `projects`, and `triggers`. Consider whether to implement as a single SQL query with ORDER BY clauses or as application-level sorting after fetching candidates. SQL is more efficient but harder to test rule-by-rule. A hybrid approach (SQL for filtering + app-level sort) may be best.
- **Trigger recency**: Join with the `triggers` table. A task has a "recently fired" trigger if it has a trigger with `status = 'fired'` and a `firedAt` timestamp. More recent `firedAt` = higher priority within the same column.
- **Actionability filter**: Exclude tasks where there exists a trigger with `status IN ('pending', 'polling')`. Tasks with no trigger, or only `fired`/`failed`/`cancelled` triggers, are actionable.
- **Column ordering**: The enum values are `backlog`, `planning`, `in_progress`, `review`. Define a column weight map for sorting.

## Testing Requirements

**Coverage target: 90%+ line coverage** (critical business logic per ADR 008).

Test in the `node` Vitest project using the mock DB helper.

### Unit tests for the priority function:

1. **Column precedence**: A task in `review` outranks a task in `in_progress`, regardless of other factors.
2. **Trigger recency within same column**: Two tasks in `in_progress` — one with a recently fired trigger outranks one without.
3. **Project rank within same column and trigger state**: Two tasks in `planning`, same trigger state — task from higher-ranked project wins.
4. **Last-touched tiebreaker**: Same column, same project, same trigger state — most recently touched task wins.
5. **Time-in-queue starvation prevention**: Same column, same project, same trigger state, same last-touched — older task wins.
6. **Backlog exclusion**: Tasks in `backlog` never appear as the focus task.
7. **Waiting task exclusion**: Tasks with `pending` or `polling` triggers are skipped.
8. **No actionable tasks**: Returns `null` when all tasks are in backlog or waiting.
9. **Queue depth calculation**: Correctly counts actionable vs. waiting tasks.
10. **Mixed scenario**: Multiple projects, columns, trigger states — verify the correct task surfaces.
11. **Archived tasks excluded**: Archived tasks never appear in priority results.

## Documentation

- Add a section to `docs/ARCHITECTURE.md` describing the priority engine module, its location, and how it's invoked.
- Add inline JSDoc to the main priority function explaining the rule precedence.

## Verification

1. Run `npm run test` — all priority engine tests pass with 90%+ coverage on `src/main/priority/`.
2. Run `npm run dev`, create multiple tasks across different projects and columns.
3. Navigate to Focus View — confirm the correct task surfaces based on the priority rules.
4. Archive a task, add a backlog task — confirm they don't appear in Focus View.
