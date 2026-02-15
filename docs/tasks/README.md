# Chaos Coordinator — Task Index

## Execution Phases

Tasks are ordered by **user flow** — each phase builds on the last so the app is testable end-to-end at every step. Within a phase, tasks can be worked in parallel unless noted.

### Phase 1: Core Engine & Infrastructure ✅

| Task                                   | Title                 | Complexity | Status |
| -------------------------------------- | --------------------- | ---------- | ------ |
| [T-001](T-001-priority-engine.md)      | Priority Engine       | M          | done   |
| [T-002](T-002-llm-integration.md)      | LLM Integration Setup | M          | done   |
| [T-013](T-013-configuration-system.md) | Configuration System  | L          | done   |

### Phase 2: Project & Task Management

Create projects, add tasks, visualize work. After this phase: open app → create projects with colors → add tasks → see kanban board → drag between columns.

| Task                                    | Title                 | Complexity | Dependencies |
| --------------------------------------- | --------------------- | ---------- | ------------ |
| [T-003](T-003-project-management-ui.md) | Project Management UI | M          | —            |
| [T-005](T-005-board-view.md)            | Board View            | L          | —            |

> **Note:** T-005 includes a quick-add feature for creating tasks directly from the board, which is sufficient for testing until T-007 (Task Intake) adds URL-based creation.

### Phase 3: Focus & Flow

The core experience loop — focus on the top task, capture context when switching. After this phase: full loop from project creation → task management → immersive focus mode → context-preserving transitions.

| Task                              | Title           | Complexity | Dependencies |
| --------------------------------- | --------------- | ---------- | ------------ |
| [T-004](T-004-focus-view.md)      | Focus View      | L          | T-001        |
| [T-008](T-008-context-capture.md) | Context Capture | M          | T-002        |

### Phase 4: Enhanced Intake & History

Richer ways to get tasks in and review completed work. After this phase: paste URLs for auto-populated tasks, browse history of completed work with column transition timelines.

| Task                           | Title        | Complexity | Dependencies |
| ------------------------------ | ------------ | ---------- | ------------ |
| [T-007](T-007-task-intake.md)  | Task Intake  | L          | T-002        |
| [T-006](T-006-archive-view.md) | Archive View | S          | —            |

### Phase 5: Proactive Intelligence

Triggers make the app proactive — tasks surface when external conditions are met. After this phase: attach triggers to tasks → conditions are polled → tasks auto-surface when ready.

| Task                             | Title          | Complexity | Dependencies |
| -------------------------------- | -------------- | ---------- | ------------ |
| [T-010](T-010-trigger-system.md) | Trigger System | XL         | T-002        |

### Phase 6: Chat & Notifications

Conversational interaction and ambient awareness. After this phase: chat with the system, run CLI commands safely, get ambient notifications when triggers fire.

| Task                                  | Title                         | Complexity | Dependencies |
| ------------------------------------- | ----------------------------- | ---------- | ------------ |
| [T-009](T-009-command-safety.md)      | Command Safety Classification | M          | T-002        |
| [T-011](T-011-chat-interface.md)      | Chat Interface                | L          | T-002, T-009 |
| [T-012](T-012-notification-system.md) | Notification System           | M          | T-010        |

## Dependency Graph

```
T-001 (Priority Engine) ──────────────────► T-004 (Focus View)

T-002 (LLM Integration) ──┬───────────────► T-007 (Task Intake)
                           ├───────────────► T-008 (Context Capture)
                           ├───────────────► T-009 (Command Safety) ──► T-011 (Chat Interface)
                           └───────────────► T-010 (Trigger System) ──► T-012 (Notifications)

T-013 (Config System)      — independent
T-003 (Project Mgmt UI)   — independent (prerequisite for all UI testing)
T-005 (Board View)         — independent (includes quick-add for task creation)
T-006 (Archive View)       — independent
```

## Recommended Implementation Order

Sequential order for solo development, optimized for continuous testability:

1. **T-003** — Project Management UI _(create projects first)_
2. **T-005** — Board View _(add tasks, see the board)_
3. **T-004** — Focus View _(immersive focus on top task)_
4. **T-008** — Context Capture _(preserve state on transitions)_
5. **T-007** — Task Intake _(URL-based task creation)_
6. **T-006** — Archive View _(view completed work)_
7. **T-010** — Trigger System _(proactive task surfacing)_
8. **T-009** — Command Safety _(prerequisite for chat)_
9. **T-011** — Chat Interface _(conversational interaction)_
10. **T-012** — Notification System _(ambient updates from triggers)_

## Status Overview

Track progress by checking the `status` frontmatter in each task file:

- **draft** — Not yet fully specified
- **ready** — Specified, ready for implementation
- **in-progress** — Being worked on
- **review** — Implementation complete, under review
- **done** — Merged and verified

## Conventions

- Task files live in `docs/tasks/` with the naming pattern `T-NNN-short-name.md`
- Each task is self-contained: an agent should be able to implement it from the task doc alone
- Spec references use `§` notation (e.g., `§3.1` = Section 3.1 of `docs/SPEC.md`)
- ADR references use the number (e.g., `ADR 003` = `docs/decisions/003-command-safety.md`)
