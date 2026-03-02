# Dev Instructions

- Thorough unit tests everywhere possible
- Code standards enforced via lint rules (or CLAUDE.md, if lint rule is impossible)
- Prefer maintainable abstractions

## Testing

- Unit tests: `npm run test` (Vitest)
- E2E tests: `npm run test:e2e` (Playwright — `webServer` config auto-starts dev server on port 5173)
- Use the Playwright MCP server to launch a browser and visually verify UI changes
- Write E2E tests in `tests/e2e/` for user-facing behavior

## Playwright MCP

The `.mcp.json` at repo root configures the `@playwright/mcp` server for Claude Code.
Use it to open `http://localhost:5173` to verify UI (both dev and prod use port 5173).

## Vibes

- Simple, classic, elegant, clean
- Runs on mobile, color e-ink tablet, or desktop
