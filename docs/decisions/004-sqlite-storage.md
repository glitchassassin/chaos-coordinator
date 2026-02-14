# ADR 004: SQLite via better-sqlite3 for Storage

**Status:** Accepted
**Date:** 2026-02-13

## Context

The priority system requires multi-criteria sorting and filtering (by column, trigger state, project rank, timestamps). The storage engine needs to support these query patterns efficiently while remaining inspectable for debugging.

Schema is defined and managed via Drizzle ORM — the Drizzle schema files are the canonical data model reference.

## Decision

Use SQLite via `better-sqlite3` with Drizzle ORM for schema definition, migrations, and queries.

## Consequences

- **Query patterns:** Multi-criteria sorting and filtering map naturally to indexed SQL queries.
- **Inspectable:** Any SQLite browser can inspect the database for debugging.
- **Synchronous:** `better-sqlite3` is synchronous, which simplifies Electron main process code (no async/await overhead for DB operations).
- **Single-user:** No concurrency concerns — single writer is fine for a single-user app.
- **Schema management:** Drizzle handles migrations, type-safe queries, and schema as code.
