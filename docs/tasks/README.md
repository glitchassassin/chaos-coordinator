# Chaos Coordinator — Task Index

## Execution Phases

Tasks are organized into phases based on dependencies. Within a phase, tasks can be worked in parallel unless noted.

### Phase 1: Core Engine & Infrastructure

| Task                                   | Title                 | Complexity | Dependencies |
| -------------------------------------- | --------------------- | ---------- | ------------ |
| [T-001](T-001-priority-engine.md)      | Priority Engine       | M          | —            |
| [T-002](T-002-llm-integration.md)      | LLM Integration Setup | M          | —            |
| [T-013](T-013-configuration-system.md) | Configuration System  | L          | —            |

### Phase 2: Core Views

| Task                                    | Title                 | Complexity | Dependencies |
| --------------------------------------- | --------------------- | ---------- | ------------ |
| [T-003](T-003-project-management-ui.md) | Project Management UI | M          | —            |
| [T-004](T-004-focus-view.md)            | Focus View            | L          | T-001        |
| [T-005](T-005-board-view.md)            | Board View            | L          | —            |
| [T-006](T-006-archive-view.md)          | Archive View          | S          | —            |

### Phase 3: Workflow Features

| Task                              | Title           | Complexity | Dependencies |
| --------------------------------- | --------------- | ---------- | ------------ |
| [T-007](T-007-task-intake.md)     | Task Intake     | L          | T-002        |
| [T-008](T-008-context-capture.md) | Context Capture | M          | T-002        |

### Phase 4: Advanced Features

| Task                                  | Title                         | Complexity | Dependencies |
| ------------------------------------- | ----------------------------- | ---------- | ------------ |
| [T-009](T-009-command-safety.md)      | Command Safety Classification | M          | T-002        |
| [T-010](T-010-trigger-system.md)      | Trigger System                | XL         | T-002        |
| [T-011](T-011-chat-interface.md)      | Chat Interface                | L          | T-002, T-009 |
| [T-012](T-012-notification-system.md) | Notification System           | M          | T-010        |

## Dependency Graph

```
T-001 (Priority Engine) ──────────────────► T-004 (Focus View)

T-002 (LLM Integration) ──┬───────────────► T-007 (Task Intake)
                           ├───────────────► T-008 (Context Capture)
                           ├───────────────► T-009 (Command Safety) ──► T-011 (Chat Interface)
                           └───────────────► T-010 (Trigger System) ──► T-012 (Notifications)

T-013 (Config System)      — independent; migrates T-002 config from env vars
T-003 (Project Mgmt UI)   — independent, but enhances T-004, T-005
T-005 (Board View)         — independent
T-006 (Archive View)       — independent
```

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
