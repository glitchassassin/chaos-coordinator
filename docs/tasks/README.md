# Chaos Coordinator — Task Index

## Execution Phases

Tasks are ordered by **user flow** — each phase builds on the last so the app is testable end-to-end at every step. Within a phase, tasks can be worked in parallel unless noted.

### Phase 1: Core Engine & Infrastructure ✅

| Task                                   | Title                 | Complexity | Status |
| -------------------------------------- | --------------------- | ---------- | ------ |
| [T-001](T-001-priority-engine.md)      | Priority Engine       | M          | done   |
| [T-002](T-002-llm-integration.md)      | LLM Integration Setup | M          | done   |
| [T-013](T-013-configuration-system.md) | Configuration System  | L          | done   |

### Phase 2: Project & Task Management ✅

Create projects, add tasks, visualize work. After this phase: open app → create projects with colors → add tasks → see kanban board → drag between columns.

| Task                                    | Title                 | Complexity | Dependencies |
| --------------------------------------- | --------------------- | ---------- | ------------ |
| [T-003](T-003-project-management-ui.md) | Project Management UI | M          | —            |
| [T-005](T-005-board-view.md)            | Board View            | L          | —            |

> **Note:** T-005 includes a quick-add feature for creating tasks directly from the board, which is sufficient for testing until T-007a (Task Intake Form) adds full-featured creation.

### Phase 2.5: Retroactive E2E Coverage

Add automated end-to-end tests for all completed work and establish e2e testing patterns for future tasks.

| Task                                       | Title                         | Complexity | Dependencies |
| ------------------------------------------ | ----------------------------- | ---------- | ------------ |
| [T-014](T-014-retroactive-e2e-coverage.md) | Retroactive E2E Test Coverage | L          | —            |

### Phase 3: Focus & Flow

The core experience loop — focus on the top task, capture context when switching. After this phase: full loop from project creation → task management → immersive focus mode → context-preserving transitions.

| Task                              | Title           | Complexity | Dependencies |
| --------------------------------- | --------------- | ---------- | ------------ |
| [T-004](T-004-focus-view.md)      | Focus View      | L          | T-001        |
| [T-008](T-008-context-capture.md) | Context Capture | M          | T-002        |

### Phase 4: Enhanced Intake & History

Richer ways to get tasks in and review completed work. After this phase: full-featured task creation form, paste URLs for auto-populated tasks, browse history of completed work with column transition timelines.

| Task                                    | Title                     | Complexity | Dependencies  |
| --------------------------------------- | ------------------------- | ---------- | ------------- |
| [T-007a](T-007a-task-intake-form.md)    | Task Intake Form          | M          | —             |
| [T-007b](T-007b-url-auto-population.md) | URL-based Auto-population | M          | T-002, T-007a |
| [T-006](T-006-archive-view.md)          | Archive View              | S          | —             |

### Phase 5: Proactive Intelligence

Triggers make the app proactive — tasks surface when external conditions are met. After this phase: attach triggers to tasks → review generated scripts → conditions are polled → tasks auto-surface when ready.

| Task                                            | Title                               | Complexity | Dependencies  |
| ----------------------------------------------- | ----------------------------------- | ---------- | ------------- |
| [T-010a](T-010a-trigger-generation-approval.md) | Trigger Generation + Approval Flow  | M          | T-002         |
| [T-010b](T-010b-trigger-execution-polling.md)   | Trigger Execution, Polling + Firing | L          | T-002, T-010a |

### Phase 6: Chat & Notifications

Conversational interaction and ambient awareness. After this phase: chat with the system, run CLI commands safely, get ambient notifications when triggers fire.

| Task                                      | Title                           | Complexity | Dependencies         |
| ----------------------------------------- | ------------------------------- | ---------- | -------------------- |
| [T-009](T-009-command-safety.md)          | Command Safety Classification   | M          | T-002                |
| [T-011a](T-011a-chat-panel.md)            | Chat Panel + Conversational LLM | M          | T-002                |
| [T-011b](T-011b-agentic-cli-execution.md) | Agentic CLI + Task Management   | M          | T-002, T-009, T-011a |
| [T-012](T-012-notification-system.md)     | Notification System             | M          | T-010b               |

## Dependency Graph

```
T-001 (Priority Engine) ──────────────────► T-004 (Focus View)

T-002 (LLM Integration) ──┬───────────────► T-007b (URL Auto-population) ──► (requires T-007a)
                           ├───────────────► T-008 (Context Capture)
                           ├───────────────► T-009 (Command Safety) ──┐
                           ├───────────────► T-010a (Trigger Gen) ──► T-010b (Trigger Exec) ──► T-012 (Notifications)
                           ├───────────────► T-011a (Chat Panel) ────┤
                           └───────────────────────────────────────────► T-011b (Agentic CLI)

T-013 (Config System)      — independent (done)
T-003 (Project Mgmt UI)   — independent (done, prerequisite for all UI testing)
T-005 (Board View)         — independent (done, includes quick-add for task creation)
T-014 (E2E Coverage)       — independent (retroactive e2e for T-001–T-005, T-013; establishes e2e patterns)
T-006 (Archive View)       — independent
T-007a (Intake Form)       — independent
```

## Recommended Implementation Order

Sequential order for solo development, optimized for continuous testability:

1. **T-014** — Retroactive E2E Coverage _(e2e infrastructure + tests for completed tasks)_
2. **T-004** — Focus View _(immersive focus on top task)_ — done
3. **T-008** — Context Capture _(preserve state on transitions)_
4. **T-007a** — Task Intake Form _(full-featured task creation)_
5. **T-007b** — URL-based Auto-population _(paste URLs for auto-populated tasks)_
6. **T-006** — Archive View _(view completed work)_
7. **T-010a** — Trigger Generation + Approval _(create and review trigger scripts)_
8. **T-010b** — Trigger Execution, Polling + Firing _(triggers actually run and fire)_
9. **T-009** — Command Safety _(prerequisite for agentic chat)_
10. **T-011a** — Chat Panel + Conversational LLM _(conversational interface)_
11. **T-011b** — Agentic CLI + Task Management _(CLI execution and task ops via chat)_
12. **T-012** — Notification System _(ambient updates from triggers)_

## Status Overview

Track progress by checking the `status` frontmatter in each task file:

- **draft** — Not yet fully specified
- **ready** — Specified, ready for implementation
- **in-progress** — Being worked on
- **review** — Implementation complete, under review
- **done** — Merged and verified

## Conventions

- Task files live in `docs/tasks/` with the naming pattern `T-NNN-short-name.md` (or `T-NNNa`/`T-NNNb` for split tasks)
- Each task is self-contained: an agent should be able to implement it from the task doc alone
- Spec references use `§` notation (e.g., `§3.1` = Section 3.1 of `docs/SPEC.md`)
- ADR references use the number (e.g., `ADR 003` = `docs/decisions/003-command-safety.md`)
