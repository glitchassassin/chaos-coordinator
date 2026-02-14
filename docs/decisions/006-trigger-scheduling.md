# ADR 006: In-Process Timers for Trigger Scheduling

**Status:** Accepted
**Date:** 2026-02-13

## Context

The trigger system needs to poll external services (GitHub CI status, Azure DevOps pipelines, etc.) on a schedule with backoff logic. Options: in-process timers, separate worker process, OS-level scheduler (cron/launchd).

## Decision

Use `setInterval`/`setTimeout` in Electron's main process with in-process backoff logic (5 min default, up to 60 min on repeated failures, reset on recovery).

## Consequences

- **Simple:** No IPC to a worker process, no OS scheduler configuration. All logic lives in one place.
- **Sufficient:** A single-user app with a small number of active triggers doesn't need the scalability of a separate worker.
- **Lifecycle:** Timers are tied to the app lifecycle — they stop when the app closes, which is the desired behavior.
- **Limitation:** If trigger checks become CPU-intensive or numerous, may need to revisit with a worker thread. Not expected for the initial scope.
