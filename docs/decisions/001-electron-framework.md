# ADR 001: Use Electron as Desktop Framework

**Status:** Accepted
**Date:** 2026-02-13

## Context

Chaos Coordinator is a macOS desktop app with UI-heavy views (kanban board, drag-and-drop, crossfade transitions). Candidates considered: Electron, Tauri, Swift/native.

End-to-end testing reliability is critical for maintaining quality with AI-agent-driven development. The app needs robust automated testing of its full UI and interaction model.

## Decision

Use Electron.

## Consequences

- **E2E testing:** Playwright has best-in-class support for Electron on macOS. Tauri's WebDriver approach has no macOS support due to WKWebView limitations.
- **Ecosystem:** Mature ecosystem for the UI patterns we need (kanban, drag-and-drop, transitions).
- **Chromium:** Ships its own Chromium, giving consistent rendering behavior.
- **Bundle size:** Larger than Tauri (~150MB+). Acceptable for a single-user desktop tool.
- **Memory:** Higher baseline memory usage than native or Tauri. Acceptable for the use case.
