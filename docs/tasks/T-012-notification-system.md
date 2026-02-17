---
id: T-012
title: 'Notification System'
status: ready
priority: 4
dependencies: ['T-010b']
spec_refs: ['§11.1']
adrs: []
estimated_complexity: M
tags: [ui, infrastructure]
created: 2026-02-14
updated: 2026-02-14
---

# T-012: Notification System

## Context

When triggers fire or the priority queue changes, the user needs to know — but without disruption. Chaos Coordinator uses ambient notifications: subtle visual indicators that the user notices at their next natural pause. No modals, no system notification popups, no sounds by default.

This is the last piece of the trigger-to-action pipeline: trigger fires (T-010b) → task becomes actionable (T-001) → user is notified (this task) → user engages (T-004 Focus View).

## Requirements

1. **Trigger-fired notification**: When a trigger fires and a task becomes actionable:
   - If the user is in Focus View and the fired task is now highest priority: subtle screen-edge pulse or highlight animation on the Focus View to indicate the displayed task changed (or is about to change).
   - If the user is in Focus View but the fired task is not highest priority: update the ambient queue indicator ("3 tasks waiting · 2 blocked" → "4 tasks waiting · 1 blocked").
   - If the user is in Board View: the card for the affected task transitions from dimmed/waiting to vivid/actionable with a brief highlight animation.

2. **Dock badge**: Update the Electron dock icon badge with the count of actionable tasks (or just a dot indicator that something changed).

3. **No disruptive notifications**: No system notification center popups, no sounds, no modals. Ambient only.

4. **Real-time updates**: When the main process detects a state change (trigger fire, task update), it pushes an event to the renderer so the UI updates without requiring manual refresh.

5. **Queue indicator updates**: The ambient queue indicator in Focus View should update in real-time as tasks become actionable or get blocked.

## Existing Code

- **Trigger system**: T-010b fires triggers in the main process
- **Priority engine**: T-001 re-evaluates priorities
- **Focus View**: T-004 shows queue indicator
- **Board View**: T-005 shows card states
- **Electron APIs**: `app.dock.setBadge()` for dock badge (macOS)

## Implementation Notes

- **Event bus**: Create a simple event emitter in the main process (`src/main/events/`) that the trigger system and other state-changing operations emit to. The main process listens to these events and pushes updates to the renderer via `webContents.send()`.
- **IPC push channel**: Define a `notifications:stateChanged` IPC channel that the main process sends to the renderer. The renderer listens via `ipcRenderer.on()` (exposed through preload). Payload: `{ type: 'trigger_fired' | 'task_updated' | 'priority_changed', taskId?, details? }`.
- **Renderer event handling**: In the renderer, create a `useNotifications` hook (or context provider) that listens for push events and triggers UI updates:
  - Refetch focus task when priority changes
  - Refetch board data when tasks update
  - Show highlight animation when a trigger fires
- **Dock badge**: In the main process, after any priority re-evaluation, update the dock badge. Use `app.dock.setBadge(count.toString())` to show the number of actionable tasks, or `app.dock.setBadge('·')` for a simple indicator. Clear the badge when Focus View is active and no new changes have occurred.
- **Pulse animation**: CSS animation — a subtle border/glow pulse on the Focus View container. Trigger it by adding a CSS class that auto-removes after the animation completes.
- **Debouncing**: If multiple triggers fire in quick succession, debounce the renderer notifications to avoid rapid UI flashing. A 500ms debounce window is reasonable.

## Testing Requirements

**Coverage target: 80% line coverage.**

### Main process tests (node Vitest project):

1. **Event emission**: Trigger fires → event emitted to the bus.
2. **IPC push**: Event on bus → `webContents.send` called with correct payload.
3. **Dock badge update**: After priority re-evaluation, dock badge is set correctly.
4. **Debouncing**: Multiple rapid events → single notification after debounce window.

### Renderer tests (jsdom Vitest project):

5. **Listens for events**: Verify the notification hook/provider registers the IPC listener.
6. **Focus View refetch**: On `priority_changed` event, verify focus task is re-fetched.
7. **Board View refetch**: On `task_updated` event, verify board data is re-fetched.
8. **Pulse animation**: On `trigger_fired` event for current focus task, verify animation class is applied.
9. **Queue indicator updates**: Verify indicator re-renders with new counts after event.

## Documentation

- Add a section to `docs/ARCHITECTURE.md` describing the notification/event system and the push model from main → renderer.

## Verification

1. Run `npm run test` — notification system tests pass.
2. Run `npm run dev`:
   - Create a task with a trigger that will fire soon.
   - Be on Focus View — when the trigger fires, observe the queue indicator update or the view transition.
   - Check the dock icon — verify a badge appears.
   - Be on Board View — verify the card transitions from dimmed to vivid with a highlight.
