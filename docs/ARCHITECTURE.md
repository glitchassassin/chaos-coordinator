# Architecture

> This document describes the high-level system architecture of Chaos Coordinator. Update it as the implementation evolves.

## System Overview

Chaos Coordinator is an Electron desktop app with three major subsystems:

```
┌─────────────────────────────────────────────────┐
│                  Renderer Process                │
│  ┌─────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  Focus   │  │  Board   │  │    Archive     │  │
│  │  View    │  │  View    │  │    View        │  │
│  └────┬─────┘  └────┬─────┘  └──────┬─────────┘  │
│       └──────────────┼───────────────┘            │
│                      │                            │
│              ┌───────┴────────┐                   │
│              │  Chat Interface│                   │
│              └───────┬────────┘                   │
└──────────────────────┼────────────────────────────┘
                       │ IPC
┌──────────────────────┼────────────────────────────┐
│                  Main Process                     │
│  ┌───────────────┐ ┌──────────────┐ ┌──────────┐  │
│  │   Priority    │ │   Trigger    │ │   CLI    │  │
│  │   Engine      │ │   Scheduler  │ │  Runner  │  │
│  └───────┬───────┘ └──────┬───────┘ └────┬─────┘  │
│          │                │              │         │
│          └────────────────┼──────────────┘         │
│                           │                        │
│                   ┌───────┴────────┐               │
│                   │  SQLite / Drizzle │             │
│                   └────────────────┘               │
└────────────────────────────────────────────────────┘
```

## Main Process Components

### Priority Engine

**Location:** `src/main/priority/engine.ts`

Evaluates the hardcoded priority rules (see SPEC.md §3) to determine the single highest-priority actionable task. The engine implements a pure function `computeFocus(db)` that:

1. Fetches all non-archived tasks with their associated projects and triggers
2. Filters out non-actionable tasks (backlog column or tasks with pending/polling triggers)
3. Sorts actionable tasks by priority rules (column position > trigger recency > project rank > last touched > time in queue)
4. Returns the highest-priority task along with queue depth statistics

**Invocation:** Called by the `tasks:focus` IPC handler whenever the renderer requests focus data. Currently triggered on-demand; future iterations will cache and invalidate on state changes.

**Testing:** Unit tested with 100% coverage in `src/main/priority/__tests__/engine.test.ts`.

### Trigger Scheduler

Manages the full trigger lifecycle: generation → user approval → immediate test → polling → firing.

1. **Generation:** When a trigger is created, the LLM generates a self-contained shell script from the natural language condition.
2. **Approval:** The script is sent to the renderer for user review. The user can approve, edit, or reject.
3. **Immediate test:** On approval, the script runs once. Exit 0 fires immediately; exit 1 starts polling; exit 2+ reports an error.
4. **Polling:** In-process timers (`setTimeout`) run the script periodically. Default interval: 5 minutes, with backoff up to 60 minutes on errors (exit 2+).
5. **Firing:** On exit 0, the trigger fires — stdout becomes `firedContext`, the task becomes actionable, and the priority engine re-evaluates.

Only triggers in `polling` status are resumed on app boot. Triggers in `pending` or `awaiting_approval` status require user interaction and are not auto-resumed.

### CLI Runner

Executes external CLI commands (`gh`, `az`, `claude`, shell). Classifies commands as read-only or mutating using an allowlist with LLM fallback. Mutating commands require user approval via IPC to renderer.

### Data Layer

SQLite database accessed via `better-sqlite3` with Drizzle ORM for schema definition and queries. The Drizzle schema files are the canonical data model reference.

## Renderer Process

Single-window app with view switching (Focus, Board, Archive) and a persistent chat interface overlay. Each project has a distinct visual identity (colors, background) applied at the view level.

## Data Flow

1. **Task intake:** User pastes link → CLI Runner fetches metadata → LLM generates context → task created in SQLite
2. **Priority evaluation:** Any state change → Priority Engine queries SQLite → Focus View updated via IPC
3. **Trigger polling:** NL condition → LLM generates check script → user approves → immediate test → polling via shell execution → on exit 0, trigger fires → task updated → priority re-evaluated
4. **Context capture:** User transitions task → LLM generates summary from current state + linked resource updates → stored in SQLite

## Key Boundaries

- **Main ↔ Renderer:** All communication via Electron IPC. Renderer never accesses SQLite directly.
- **CLI execution:** Chat interface commands route through CLI Runner for safety classification. Trigger scripts bypass safety classification — they are user-approved at creation time (see SPEC.md §6.2).
- **LLM calls:** All LLM interactions go through the Vercel AI SDK abstraction layer.
