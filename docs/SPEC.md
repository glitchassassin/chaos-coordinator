# Chaos Coordinator — Product Spec

**Version:** 0.1 (Draft)
**Date:** 2026-02-13
**Author:** Jon (with Claude)

---

## 1. Overview

Chaos Coordinator is a single-user macOS desktop application that acts as a flow-state manager for developers context-switching across multiple projects. It maintains working memory across active tasks, surfaces the most important next action, and provides enough context to resume work immediately.

The system answers one question: **"What should I do right now, and what do I need to know to start?"**

### 1.1 Key Principles

- **Opinionated by default, transparent on demand.** The system picks your next task. You can always see why and override it.
- **Context is king.** Every task carries an LLM-generated summary of where you left off and what to do next. Resuming a task should take seconds, not minutes.
- **Triggers over timers.** Work surfaces when external events (agent completion, build results, PR reviews) make it actionable, not because you remembered to check.
- **Minimal interaction overhead.** Intake, shelving, and phase transitions are fast and mostly pre-populated. The tool should reduce cognitive load, not add to it.

---

## 2. User-Facing Views

### 2.1 Focus View (Default)

A full-screen, immersive display of the single highest-priority actionable task. This is the primary interface — where you spend most of your time.

**Visual treatment:**

- Each project has a distinct visual identity: background image/color and color scheme. Typography remains consistent across all projects.
- The project's visual identity fills the screen, acting as a cognitive primer to help the user "load" the right mental context before reading any text.
- Transitions between tasks from different projects use a 300–500ms crossfade to give the brain a beat to context-switch.

**Content displayed:**

- **Project name** and visual identity
- **Task title** — phrased as an action (e.g., "Refactor auth middleware to use client certs")
- **Context block** — 3–5 sentences, LLM-generated, covering: where you left off, key decisions already made, and the next concrete action to take
- **Trigger info** (if applicable) — why this task surfaced now (e.g., "Agent completed on PR #247" or "CI build passed")
- **Links** — clickable references to the associated GitHub issue, PR, Azure DevOps work item, etc.
- **Ambient queue indicator** — subtle text at the bottom edge showing queue depth (e.g., "3 tasks waiting · 2 blocked")

**Interactions:**

- **Complete phase / move to next column** — marks the task as progressed, triggers context capture (see §5), then reveals the next highest-priority task
- **Defer** — push this task down; show the next one instead, without changing the task's column
- **Switch to Board View** — intentional action to see the full picture
- **Open Chat** — access the general-purpose chat interface (see §7)

### 2.2 Board View (Situational Awareness)

A kanban board showing all active work. Used for daily planning, manual reordering, and understanding the state of everything in flight.

**Layout:**

- **Columns (left to right):** Backlog → Planning → In Progress → Review/Verify
- **Swim lanes:** One horizontal lane per project, ordered top-to-bottom by project priority rank. Swim lanes are reorderable by vertical drag — changing lane order changes project priority.

**Card display (compact):**

- Project color/icon indicator
- Task title
- Waiting-on indicator (if blocked on a trigger): icon + short label (e.g., "⏳ Agent running", "🔨 Build pending")
- Time in current column (e.g., "2d in Planning")

**Card visual states:**

- **Actionable** — vivid, full opacity
- **Waiting/blocked** — dimmed, with waiting-on indicator
- **Triggered (just became actionable)** — brief highlight animation to draw attention

**Interactions:**

- Drag cards between columns to change phase
- Drag swim lanes vertically to change project priority
- Click a card to expand it (edit title, context, links, trigger condition)
- Add new task (see §4)
- Switch to Focus View

### 2.3 Archive View

A searchable, read-only list of completed tasks. Separate from Focus View and Board View. Used for reference and history.

**Content per archived task:**

- Task title
- Project name
- Final context block (as captured at completion)
- Links
- Timestamps: created, completed
- Column transition history (when it moved through each phase)

---

## 3. Priority System

Priority is determined by a hardcoded rule set, evaluated top-to-bottom. The system selects the single highest-priority actionable (not waiting) task to display in Focus View.

### 3.1 Priority Rules (in order of precedence)

1. **Column position** — Review/Verify > In Progress > Planning > Backlog. Tasks further right on the board are always higher priority than tasks further left.

2. **Trigger recency** — Within the same column, a task whose trigger fired recently (especially "waiting on you" triggers like an agent needing input) outranks tasks without a recent trigger.

3. **Project rank** — Within the same column and trigger state, tasks belonging to higher-ranked projects (higher swim lane on the board) take precedence.

4. **Last touched** — Within the same column, project rank, and trigger state, the task you most recently actively worked on gets a tiebreaker boost to preserve momentum and reduce re-orientation cost.

5. **Time in queue** — All else being equal, tasks that have been waiting longer bubble up gradually to prevent starvation.

### 3.2 Actionability

A task is **actionable** if it is not currently waiting on a trigger. Tasks waiting on triggers are skipped by the priority system and do not appear in Focus View until their trigger fires or is manually cleared.

A task in the Backlog column is **not actionable** for Focus View purposes — Backlog items only appear on the Board View. A task must be in Planning, In Progress, or Review/Verify to surface in Focus View.

---

## 4. Task Intake

### 4.1 Flow

1. User pastes a link (GitHub issue URL, PR URL, Azure DevOps work item URL, etc.) into the intake field.
2. The system detects the source type and uses the appropriate CLI tool (e.g., `gh`, `az`) to fetch metadata: title, description, status, labels, linked resources, recent comments.
3. An LLM generates a context summary from the fetched metadata.
4. The system infers project association from the repository or organization. If the repo is unknown, the user is prompted to assign it to an existing project or create a new one.
5. A pre-populated task card is presented with: title, context block, links, inferred project, and default column (Planning).
6. The user reviews, revises if needed, optionally sets a trigger condition (see §6), and confirms.

### 4.2 Task Fields

| Field             | Type                                                 | Source                                                           |
| ----------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| Title             | Text                                                 | Auto-populated from linked resource, editable                    |
| Context block     | Text (3–5 sentences)                                 | LLM-generated from linked resource metadata, editable            |
| Links             | List of URLs                                         | The pasted URL plus any linked resources discovered during fetch |
| Project           | Reference                                            | Inferred from repo/org, editable                                 |
| Column            | Enum (Backlog, Planning, In Progress, Review/Verify) | Defaults to Planning, editable                                   |
| Trigger condition | Natural language text                                | Optional, user-specified (see §6)                                |

---

## 5. Context Capture (Shelving)

When a user leaves a task — whether completing a phase, getting blocked, or switching to a higher-priority triggered task — the system captures context for future resumption.

### 5.1 Flow

1. The user initiates a transition (completes phase, defers, or a higher-priority task takes over).
2. The system generates a pre-populated context summary via LLM, informed by: the task's current phase, trigger info, the previous context block, any linked resource updates since last capture (fetched via CLI), and the nature of the transition.
3. The user sees the proposed context block and either confirms (one click) or edits it.
4. Target interaction time: under 15 seconds.

### 5.2 When Context Capture Occurs

- **Phase transition** (card moves between columns): always prompt for context capture.
- **Deferred by user** (switching to a different task without changing phase): prompt for context capture, but allow skipping (the previous context block is retained).
- **Preempted by trigger** (a higher-priority task surfaces): prompt for a quick capture, but make it frictionless — the user is being pulled away and doesn't want a speed bump. Default to auto-generated summary with a "confirm or edit later" option.

---

## 6. Trigger System

Triggers are conditions that, when met, make a waiting task actionable. They are the primary mechanism for surfacing work that was blocked on external events.

### 6.1 Trigger Definition

When adding or editing a task, the user may specify a trigger condition in **natural language**. Examples:

- "The CI build on PR #247 in openclaw/core passes"
- "Claude Code agent session finishes"
- "The Azure DevOps pipeline for release/2.1 completes successfully"
- "PR #52 gets approved by at least one reviewer"
- "30 minutes have passed" (simple timer)

The system generates a self-contained shell script to check the condition (see §6.2). The user reviews and approves the script before polling begins.

### 6.2 Trigger Evaluation

When a trigger is created, the system uses an LLM to generate a **self-contained shell script** that checks the condition. The user reviews and approves the script before any execution occurs. At poll time, the system simply runs the script and checks the exit code — no LLM is needed.

**Exit code convention:**

- **Exit 0** — condition met (trigger should fire)
- **Exit 1** — condition not met (keep polling)
- **Exit 2+** — error (script failed; increment failure count, apply backoff)

The script's stdout when exiting 0 is captured as the trigger's `firedContext` (e.g., "PR #247 merged by @alice at 2026-02-14T10:00Z").

**User approval flow:**

1. **Generate:** LLM produces a shell script from the natural language condition.
2. **Review:** The user sees the generated script and can:
   - **Approve** — the script is accepted as-is.
   - **Edit** — the user modifies the script, then approves.
   - **Reject** — the trigger is cancelled; no polling begins.
3. **Immediate test:** On approval, the script runs once immediately:
   - Exit 0 → the trigger fires right away (condition already met).
   - Exit 1 → the trigger enters the polling loop.
   - Exit 2+ → the trigger is marked failed; the user is shown the error (stderr) and can edit the script.

**Polling schedule:**

- Initial interval: every 5 minutes
- On repeated failures (exit 2+): gradual backoff up to every 60 minutes
- On success (exit 0): stop polling, fire the trigger
- On recovery after failure: reset to 5-minute interval

**Execution constraints:**

- Scripts run in a sandboxed shell with a 30-second timeout.
- stdout and stderr are captured for debugging and context.
- The user has already approved the script, so no further safety classification is needed at poll time.

**File-based integration pattern:**

Trigger scripts can check for the existence of sentinel files, enabling external tools to signal events without a direct API:

```bash
# Example: check if a Claude Code hook has signaled completion
FILE="$HOME/.chaos-coordinator/triggers/trigger-${TRIGGER_ID}.signal"
if [ -f "$FILE" ]; then
  cat "$FILE"   # stdout becomes firedContext
  rm "$FILE"
  exit 0        # condition met
fi
exit 1          # not yet
```

External tools (Claude Code hooks, CI webhooks, cron jobs) create sentinel files to trigger events. A Claude Code hook example:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": { "tool_name": "stop" },
        "command": "echo 'Agent session completed' > ~/.chaos-coordinator/triggers/trigger-42.signal"
      }
    ]
  }
}
```

### 6.3 Trigger Firing

When a trigger condition is met:

1. The task's waiting state is cleared; it becomes actionable.
2. The task is annotated with trigger context (what happened, when).
3. The task is re-evaluated by the priority system.
4. If the task is now the highest-priority item, the Focus View updates with an ambient notification (subtle screen-edge pulse or badge). No disruptive modal or overlay.
5. If the task is not the highest-priority item, it enters the priority queue at its natural position. The ambient queue indicator in Focus View updates.

### 6.4 Manual Trigger Override

The user may manually clear a waiting state at any time (via the Board View card or Focus View), marking the task as actionable regardless of the trigger condition. The user may also re-arm or edit a trigger condition.

---

## 7. Chat Interface

A general-purpose chat interface is available from any view. It provides conversational access to the same CLI tools and skills that the background trigger agents use.

### 7.1 Capabilities

- Conversational interaction with an LLM
- Agentic execution of CLI commands (e.g., `gh`, `az`, `git`, general shell commands)
- Access to project context (the chat is aware of all tasks, their states, and their linked resources)
- Can be used for ad-hoc queries ("what's the status of PR #52?"), task management ("move the auth refactor task to Review"), or general assistance

### 7.2 Command Safety Model

All CLI commands executed through the chat interface (or by any agent in the system) are classified before execution:

**Read-only commands** — Commands that inspect state without modifying it (e.g., `gh pr status`, `git log`, `az pipelines runs list`). These execute immediately without user approval. Trigger scripts are user-approved and bypass command safety classification (see §6.2).

**Potentially mutating commands** — Commands that may change external state (e.g., `gh pr merge`, `git push`, `az pipelines run`). These are **raised to the user for approval** before execution. The user sees the exact command and can approve, modify, or reject it.

**Classification approach:** The background agent inspects each command before execution and classifies it as read-only or potentially mutating. The classification should err on the side of caution — if uncertain, treat as mutating and require approval. The specific classification implementation (allowlist, LLM-based analysis, or hybrid) is an architectural decision to be made during implementation.

---

## 8. Project Configuration

### 8.1 Project Properties

| Property                | Description                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------- |
| Name                    | Display name for the project                                                            |
| Color scheme            | Primary and accent colors used for the project's visual identity                        |
| Background image        | Optional background image for Focus View                                                |
| Priority rank           | Vertical position in the Board View swim lanes (drag to reorder)                        |
| Repository associations | One or more repos/orgs mapped to this project (used for auto-association during intake) |

### 8.2 Project Management

Projects are created either explicitly (in a settings/management view) or implicitly during task intake when a link is pasted from an unrecognized repo. Projects can be edited and reordered at any time. Deleting a project archives all its tasks.

---

## 9. Data Persistence

All application state is persisted locally on disk.

### 9.1 Stored Data

- Task records (all fields from §4.2, plus: column, waiting state, trigger condition, trigger evaluation state, last-touched timestamp, creation timestamp)
- Project configuration (all fields from §8.1)
- Archive of completed tasks (all fields plus completion timestamp and column transition history)
- User preferences (if any emerge)

### 9.2 Storage Format

SQLite via `better-sqlite3` with Drizzle ORM. The Drizzle schema files are the canonical data model reference — see ADR [004](decisions/004-sqlite-storage.md) for rationale.

---

## 10. Platform & Integration

### 10.1 Platform

- macOS desktop application
- Technology stack to be determined during implementation (candidates: Tauri, Electron, Swift/native)

### 10.2 External Integrations (via CLI)

The application leverages locally installed and authenticated CLI tools rather than managing its own API credentials. Required CLIs:

| Tool                       | Purpose                                                    |
| -------------------------- | ---------------------------------------------------------- |
| `gh` (GitHub CLI)          | Fetch issue/PR metadata, check CI status, PR review status |
| `az` (Azure CLI)           | Fetch Azure DevOps work items, pipeline status             |
| `claude` (Claude Code CLI) | Agent session status, hooks                                |
| General shell              | Arbitrary read-only commands for custom trigger conditions |

Additional CLI integrations can be added over time without architectural changes.

### 10.3 LLM Integration

The application requires access to an LLM for:

- Context summary generation (intake and shelving)
- Natural language trigger interpretation (one-time script generation; no LLM needed at poll time)
- Chat interface responses
- Command safety classification (if using LLM-based approach)

The specific LLM provider and model are implementation decisions. The application should use a consistent interface that allows swapping providers.

---

## 11. Notification & Interruption Model

### 11.1 Ambient by Default

When a trigger fires or the priority queue changes, the system uses **ambient notification** rather than disruptive alerts:

- A subtle visual indicator (screen-edge pulse, badge on dock icon, or Focus View badge) signals that something changed.
- The user notices at their next natural pause and can choose to engage.
- No modals, no system notification popups, no sounds by default.

### 11.2 Priority-Based Escalation (Future)

A potential future enhancement: allow high-priority triggers to escalate to a more visible notification (e.g., a macOS system notification). Not in initial scope — start with ambient-only and see if it's sufficient.

---

## 12. Implementation Decisions

Implementation decisions are recorded as Architecture Decision Records (ADRs) in `docs/decisions/`. See the [decision log](decisions/README.md) for the full list.
