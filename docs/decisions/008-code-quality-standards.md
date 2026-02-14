# ADR 008: Code Quality and Testing Standards

**Status:** Accepted
**Date:** 2026-02-13

## Context

AI agents write a significant portion of the code. Without automated enforcement, style drift and quality gaps compound across sessions. Process-based standards (e.g., "remember to write tests") don't work when the "team" is a rotating cast of agents. Standards must be enforced by tooling, not convention.

## Decision

### Linting & Formatting

- **ESLint** with strict TypeScript rules. No `eslint-disable` without an accompanying comment explaining why.
- **Prettier** for formatting. No style debates.
- **Pre-commit hooks** via `lint-staged` + `husky` — nothing unformatted reaches the repo.

### TypeScript Strictness

- `strict: true`
- `noUncheckedIndexedAccess: true` — forces handling `undefined` on array/object access
- `exactOptionalProperties: true` — distinguishes `undefined` from missing
- No `any` types (enforced via `@typescript-eslint/no-explicit-any`)

### Testing

- **80% line coverage overall** as a CI gate.
- **90%+ coverage on critical business logic:** priority engine, trigger system, command safety classification.
- **Testing pyramid:** unit tests for logic, Playwright E2E for user flows, minimal integration layer.
- **All tests must pass to merge.**

### CI Gates (merge blockers)

1. Lint passes
2. Typecheck passes
3. All tests pass
4. Coverage does not drop below threshold

### Explicitly excluded

- Mutation testing — high overhead, diminishing returns
- Cyclomatic complexity limits — more noise than signal in practice
- Mandatory JSDoc — TypeScript types are sufficient; comments only where logic isn't self-evident

## Consequences

- **Friction:** Pre-commit hooks and strict TypeScript add a small speed bump. Worth it for the bugs they prevent.
- **Coverage threshold:** 80% is achievable without contorting code. Can raise later as the codebase matures.
- **Critical path coverage (90%+):** The priority engine, trigger system, and safety classification are the core of the app — bugs there directly impact user trust. Higher bar is justified.
- **Config as documentation:** Standards live in `eslint.config.js`, `tsconfig.json`, and CI config. No separate conventions doc to maintain or drift from reality.
