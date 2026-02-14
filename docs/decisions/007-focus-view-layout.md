# ADR 007: Build Focus View Layout Iteratively

**Status:** Accepted
**Date:** 2026-02-13

## Context

The Focus View is the primary interface — a full-screen display of the highest-priority task with project visual identity, context block, trigger info, and links. Getting the visual design right upfront is difficult without real content and usage.

## Decision

Start with a functional layout that satisfies the spec requirements. Refine placement, sizing, and visual polish through actual usage rather than upfront mockups.

## Consequences

- **Faster start:** No design phase blocking implementation. Build, use, refine.
- **Real feedback:** Layout decisions informed by actual content and workflow, not hypotheticals.
- **Risk:** Early versions may look rough. Acceptable for a single-user tool where function matters more than first impressions.
