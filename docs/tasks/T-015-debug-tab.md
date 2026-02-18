---
id: T-015
title: 'Debug Tab + Settings Model Validation'
status: review
priority: 2
dependencies: []
spec_refs: []
adrs: []
estimated_complexity: L
tags: [infra, ui, dx]
created: 2026-02-18
updated: 2026-02-18
---

# T-015: Debug Tab + Settings Model Validation

## Context

The app has no developer visibility into its runtime behavior. LLM calls, IPC traffic, and async operations are invisible — debugging requires adding console.log statements and watching devtools. Additionally, the Settings page saves the model name without checking whether it actually works, so users don't learn about typos or invalid models until an LLM feature fails later.

This task adds two features:

1. **Debug tab** — a 6th nav tab with a log stream, async task tracker, and IPC traffic monitor
2. **Settings model validation** — test the LLM connection when saving model/API key, show inline error if it fails

## Requirements

### Part 1: Debug Tab

1. **Log stream panel**: Displays structured log events from the main process. Supports level filtering (debug/info/warn/error), source filtering, auto-scroll with pause toggle. Color-coded levels. Expandable rows for extra data.

2. **Async task panel**: Tracks LLM and CLI operations. Groups events by `operationId`. Shows in-flight operations with live elapsed timer at top; completed operations below. Color: green (success), red (failure), blue-pulse (in-flight).

3. **IPC traffic panel**: Table showing channel, timestamp, duration (ms), request/response sizes, and success/error status. Channel text filter. Sortable by duration.

4. **Ring buffer**: Events stored in a bounded ring buffer (max 1000) in the main process. Renderer caps at 500.

5. **Push-based delivery**: Renderer subscribes via `debug:subscribe` (gets snapshot), receives new events via `webContents.send('debug:event', ...)`, unsubscribes via `debug:unsubscribe`.

6. **Zero overhead when unsubscribed**: DebugEventBus skips push to webContents when no subscribers. IPC instrumentation always captures but only emits to subscribers.

7. **IPC instrumentation**: Wraps `ipcMain.handle` to capture channel, duration, payload sizes, and success/error for all channels except `debug:*`.

### Part 2: Settings Model Validation

8. **Model validation**: After saving `llm.model` or `llm.apiKey`, call `llm:validateModel` with the current model value. Show "Validating model..." spinner while in flight. On failure, show inline error on the model field. On success, clear any existing error.

9. **Skip first-run**: Don't validate during first-run API key save (app reloads in 1.5s).

10. **Error classification**: 401 → "Invalid API key", 404 → "Model not found", 429 → "Rate limited", else generic message.

## Implementation Notes

- `DebugEventBus` is a singleton in the main process. Each event gets an auto-increment id and `Date.now()` timestamp on emit.
- IPC instrumentation must be installed BEFORE `registerIpcHandlers()` in `main/index.ts`.
- The `createLogger(source)` factory replaces scattered `console.error`/`console.warn` calls.
- `trackAsync(taskType, labelFn, fn)` wraps async functions for LLM and CLI operations.
- Preload exposes `on(channel, callback)` and `off(channel)` for push-based events.

## Testing Requirements

**Coverage target: 80% line coverage.**

### Unit tests — node Vitest project:

1. **RingBuffer**: capacity enforcement (overflow drops oldest), `toArray()` oldest-first, `clear()`, `size`.
2. **DebugEventBus**: emit adds to buffer, pushes to subscriber webContents, skips push when no subscribers, auto-cleans destroyed webContents.
3. **IPC instrumentation**: wrap captures channel/duration/status, skips `debug:*` channels.
4. **Logger**: warn/error write to real console, debug/info do not.
5. **validateModel**: returns `{ valid: true }` on success, correct error for 401/404/429, generic for other errors, returns not-configured error when API key missing.
