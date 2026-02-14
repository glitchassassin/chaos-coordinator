# Chaos Coordinator — Claude Code Instructions

## Project Overview

Chaos Coordinator is a single-user macOS Electron desktop app that manages developer context-switching across multiple projects. See `docs/SPEC.md` for the full product spec.

## Key Documentation

- `docs/SPEC.md` — Product specification (features, behavior, UX)
- `docs/ARCHITECTURE.md` — System architecture and component boundaries
- `docs/decisions/` — Technical decision log (ADRs); read before proposing alternatives to settled decisions
- `docs/references/` — Standard patterns and solutions for recurring problems

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

- **All standards are enforced by tooling** — lint, typecheck, and CI gates. See ADR [008](docs/decisions/008-code-quality-standards.md) for rationale.
- Run `npm run lint` before committing. Pre-commit hooks enforce this automatically.
- TypeScript `strict` mode is on. No `any` types without an ESLint disable comment explaining why.
- **Coverage:** 80% line coverage overall. 90%+ on critical business logic (priority engine, trigger system, command safety).
- Data model changes go through Drizzle schema files — those are the canonical schema reference.
- When you encounter a recurring pattern or solution worth standardizing, check `docs/references/` for existing guidance and add new entries there.
