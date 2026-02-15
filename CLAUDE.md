# Chaos Coordinator — Claude Code Instructions

## Project Overview

Chaos Coordinator is a single-user macOS Electron desktop app that manages developer context-switching across multiple projects. See `docs/SPEC.md` for the full product spec.

## Key Documentation

- `docs/SPEC.md` — Product specification (features, behavior, UX)
- `docs/ARCHITECTURE.md` — System architecture and component boundaries
- `docs/decisions/` — Technical decision log (ADRs); read before proposing alternatives to settled decisions
- `docs/references/` — Standard patterns and solutions for recurring problems
- `docs/tasks/` — Implementation task breakdown with frontmatter metadata (status, dependencies, spec refs). Read `docs/tasks/README.md` for the dependency graph and execution order. **When completing a task, update its `status` frontmatter** (draft → ready → in-progress → review → done).

## Tech Stack

- **Desktop framework:** Electron
- **Database:** SQLite via `better-sqlite3`, schema defined with Drizzle ORM (canonical data model)
- **LLM integration:** Vercel AI SDK (provider-agnostic)

## Commands

<!-- Update these once the project scaffolding is in place -->

```
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # Production build
npm run test         # Run tests
npm run lint         # Lint + typecheck
```

## Code Quality

All standards are enforced by a 4-layer system. See ADR [008](docs/decisions/008-code-quality-standards.md) for rationale.

- **Before committing:** Run `npm run lint` proactively. The pre-commit hook enforces lint-staged + project-wide typecheck as a backstop.
- **Before pushing:** Run `npm run test` proactively. The pre-push hook enforces the full test suite with coverage thresholds as a backstop.
- **CI (GitHub Actions):** Runs lint, typecheck, and tests on all PRs to `main`. This is the final gate and audit trail.
- **Standards:** TypeScript `strict` mode is on. No `any` types without an ESLint disable comment explaining why. 80% line coverage overall; 90%+ on critical business logic (priority engine, trigger system, command safety).
- Data model changes go through Drizzle schema files — those are the canonical schema reference.
- When you encounter a recurring pattern or solution worth standardizing, check `docs/references/` for existing guidance and add new entries there.
