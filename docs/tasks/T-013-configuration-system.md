---
id: T-013
title: 'Configuration System'
status: draft
priority: 1
dependencies: []
spec_refs: ['§9.1', '§10.3']
adrs: ['011']
estimated_complexity: L
tags: [core, infrastructure]
created: 2026-02-14
---

# T-013: Configuration System

## Context

All app configuration currently comes from environment variables, which requires manual shell setup and leaves secrets in plaintext. ADR 011 specifies a schema-driven key/value configuration system with `safeStorage` encryption for sensitive values, automatic UI generation, and agent tool access.

This task implements that system and migrates the LLM provider away from `process.env`.

## Requirements

1. **Define the configuration schema** in `src/shared/` using Zod. Each key specifies: type, default, sensitive flag, and presentation metadata (label, description, group). The schema must be importable by both main and renderer processes.

2. **Implement the config store** in the main process. It must:
   - Read/write a single JSON file in `app.getPath('userData')`
   - Encrypt sensitive values with `safeStorage.encryptString()` before writing; decrypt on read
   - Validate every `set()` call against the schema's Zod validator
   - Return typed values from `get()` (return type derived from schema, not `unknown`)
   - Support `reset(key)` to restore a key's default value
   - Handle the case where `safeStorage.isEncryptionAvailable()` is false (degrade gracefully — warn the user, refuse to store sensitive values)

3. **Expose IPC channels:**
   - `config:get(key)` — returns decrypted value (for renderer) or `null` for sensitive keys (for agents, when that distinction is needed)
   - `config:set(key, value)` — validates and persists
   - `config:getAll()` — returns all current values (sensitive values masked)
   - `config:getSchema` — returns schema metadata for UI generation (no values)
   - `config:reset(key)` — restores default

4. **Migrate the LLM provider** (`src/main/llm/provider.ts`) from `process.env` to the config store. Remove env var reads. Update `getConfig()` to use `configStore.get('llm.apiKey')` etc.

5. **Settings UI**: Implement a settings view in the renderer that:
   - Reads the schema via `config:getSchema`
   - Renders a form grouped by the schema's `group` field
   - Maps schema types to appropriate input widgets (text, password, select, toggle)
   - Validates on blur/submit and shows inline errors
   - Persists changes via `config:set`

6. **First-run experience**: If required config keys (like `llm.apiKey`) have no value on app launch, guide the user to the settings UI. This can be as simple as showing the settings view with a message — no elaborate onboarding wizard needed.

## Existing Code

- **LLM config reads**: `src/main/llm/provider.ts` — `getConfig()` reads `process.env`
- **IPC registration**: `src/main/ipc/index.ts`
- **IPC type map**: `src/shared/types/ipc.ts`
- **Preload bridge**: `src/preload/index.ts`
- **App data path**: Already uses `app.getPath('userData')` for the database

## Implementation Notes

### Module structure

```
src/shared/config/
  schema.ts          — Config schema definition (Zod + metadata)
  types.ts           — Derived TypeScript types

src/main/config/
  store.ts           — ConfigStore class (read, write, encrypt, validate)
  index.ts           — Singleton instance + public API

src/main/ipc/
  config.ts          — IPC handlers for config channels
```

### Schema design

Use a `defineConfig()` helper that accepts a record of key definitions and returns both the schema metadata and a TypeScript type map. The type map enables:

```typescript
// Compile-time: get() returns string, not unknown
const model: string = configStore.get('llm.model')
```

Each schema entry:

```typescript
{
  type: z.string(),           // Zod validator
  default?: <value>,          // Optional default
  sensitive: boolean,         // Encrypt at rest?
  label: string,              // UI display name
  description: string,        // UI help text
  group: string,              // UI grouping
}
```

### Storage format

Single JSON file (`config.json`) in userData. Example on disk:

```json
{
  "llm.provider": "openrouter",
  "llm.apiKey": { "__encrypted": true, "data": "base64-ciphertext..." },
  "llm.model": "anthropic/claude-3.5-sonnet"
}
```

### safeStorage usage

- Call `safeStorage.isEncryptionAvailable()` after `app.whenReady()`
- `encryptString(value)` → `Buffer` → `.toString('base64')` → store as `{ __encrypted: true, data }`
- Read: `Buffer.from(data, 'base64')` → `decryptString(buffer)` → plain value
- If encryption is unavailable, `set()` on sensitive keys should throw with a clear error. Do not silently store plaintext.

### LLM provider migration

`src/main/llm/provider.ts` `getConfig()` currently does:

```typescript
const apiKey = process.env.OPENROUTER_API_KEY
```

Change to:

```typescript
const apiKey = configStore.get('llm.apiKey')
```

Update the health check IPC handler to use config store instead of checking `process.env`.

### Settings UI

Keep it simple — a modal or dedicated view with form fields generated from the schema. No drag-and-drop, no live preview. The schema provides everything needed to render the form:

- Iterate `config:getSchema` response, group by `group`
- Render each field as the appropriate input type
- On save, call `config:set` for each changed field
- Show validation errors inline

## Testing Requirements

**Coverage target: 80% line coverage.**

Test in the `node` Vitest project (config store, IPC handlers) and `renderer` project (settings UI).

1. **Schema validation**: Test that `set()` rejects invalid values per Zod schema.
2. **Storage round-trip**: Test write → read for both plain and sensitive values. Mock `safeStorage` in tests.
3. **Encryption unavailable**: Test graceful failure when `safeStorage.isEncryptionAvailable()` returns false.
4. **Defaults**: Test that `get()` returns the default when no value is stored.
5. **Reset**: Test that `reset()` restores the default and removes the stored value.
6. **IPC handlers**: Test config IPC channels route correctly.
7. **Type safety**: Verify (via type tests or compile checks) that `get()` returns the correct type per key.
8. **LLM provider migration**: Update existing provider tests to use config store instead of `process.env`.

## Verification

1. `npm run lint` passes (typecheck + lint).
2. `npm run test` passes with coverage targets met.
3. Run `npm run dev`. On first launch, the app should prompt for settings (no API key configured).
4. Enter an API key in the settings UI. Verify it persists across app restarts.
5. Inspect `config.json` in userData — the API key value should be encrypted (base64 blob, not plaintext).
6. LLM features work using the stored config (not env vars).
