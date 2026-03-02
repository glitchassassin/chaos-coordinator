# Task 00 — Project Setup

## Goal

Bootstrap the repo with the full tech stack: React Router v7 (framework mode) on Hono, TypeScript, SQLite via Drizzle, Vitest, ESLint, Tailwind CSS v4.

## Subtasks

- [ ] `npm init`, install dependencies:
  - `react-router` (v7, framework mode), `@react-router/node`, `@hono/node-server`, `hono`
  - `react`, `react-dom`
  - `better-sqlite3`, `drizzle-orm`, `drizzle-kit`
  - `tailwindcss` (v4), `@tailwindcss/vite`
  - Dev: `typescript`, `vite`, `vitest`, `eslint`, `prettier`, `@types/*`
  - Dev: `@playwright/test`
- [ ] Configure `tsconfig.json` (strict, NodeNext module resolution for server code)
- [ ] Configure Vite with React Router plugin and Tailwind
- [ ] Configure ESLint flat config (strict TypeScript checking)
- [ ] Configure Vitest
- [ ] Configure Playwright for E2E testing
  - `npx playwright install chromium` (chromium only — keep it lean)
  - `playwright.config.ts` with `webServer` to auto-start the dev server
  - Add a smoke test that verifies the hello-world page loads
- [ ] Configure the Playwright MCP server for Claude Code
  - Add `.mcp.json` to repo root with the `@playwright/mcp` server
  - This lets Claude Code drive a browser to visually verify UI changes
- [ ] Add npm scripts: `dev`, `build`, `start`, `lint`, `test`, `test:e2e`, `validate`, `db:generate`, `db:migrate`
- [ ] Add Playwright instructions to `CLAUDE.md`
- [ ] Verify `npm run dev` serves a hello-world page on localhost

## Acceptance

- `npm run dev` starts the app (Hono + React Router)
- `npm run lint` passes
- `npm run test` passes (with a trivial placeholder test)
- `npm run test:e2e` passes (Playwright smoke test loads the app)
- `npm run build && npm start` serves production build

## References

- Requirements: Tech Stack, Non-Functional
