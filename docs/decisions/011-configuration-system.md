# ADR 011: Schema-Driven Configuration System

**Status:** Accepted
**Date:** 2026-02-14

## Context

Chaos Coordinator currently reads all configuration from environment variables (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`). This works for development but violates the product's core principle of minimal interaction overhead (SPEC §1.1):

- Users must set env vars in their shell profile or a `.env` file before the app works.
- There is no UI for configuration — no settings screen, no first-run setup.
- API keys sit in plaintext on disk.
- External integrations (agent tool calls) have no way to read or write configuration.

T-002 requirement §6 called for "at minimum, support environment variables and a config file." The config file was never implemented.

As the app grows, more configuration will emerge (notification preferences, appearance, project defaults). We need a system that scales without requiring new UI code for each setting.

## Decision

Implement a **key/value configuration store** with a **declarative TypeScript schema** that drives validation, storage routing, UI generation, and agent tool access.

### Schema

Each configuration key is defined once in a shared schema. The schema is the single source of truth for:

- **Type and validation** — runtime validation on every write
- **Sensitivity** — whether the value is encrypted at rest
- **Presentation** — label, description, group, input type (for UI generation)
- **Defaults** — fallback values when no explicit value is set

The schema lives in `src/shared/` so both main and renderer processes can import it. It uses Zod for runtime validation and TypeScript type inference, keeping the type of `configStore.get('llm.apiKey')` derived from the schema at compile time rather than returning `unknown`.

Example shape (conceptual — implementation may adjust):

```typescript
const configSchema = defineConfig({
  'llm.provider': {
    type: z.enum(['openrouter']),
    default: 'openrouter',
    sensitive: false,
    label: 'Provider',
    description: 'LLM provider to use',
    group: 'LLM'
  },
  'llm.apiKey': {
    type: z.string().min(1),
    sensitive: true,
    label: 'API Key',
    description: 'Your OpenRouter API key',
    group: 'LLM'
  },
  'llm.model': {
    type: z.string(),
    default: 'anthropic/claude-3.5-sonnet',
    sensitive: false,
    label: 'Model',
    description: 'Which model to use',
    group: 'LLM'
  }
})
```

### Storage

A **single JSON file** in `app.getPath('userData')` stores all configuration. Sensitive values are encrypted using Electron's `safeStorage` API before writing, stored as a marked wrapper (e.g., `{ __encrypted: true, data: "<base64>" }`), and decrypted transparently on read. Non-sensitive values are stored as plain JSON.

This means the file is human-readable for non-secret settings and opaque for secrets — a good balance of debuggability and security.

### Credential Security — `safeStorage`

Electron's built-in `safeStorage` module wraps Chromium's OSCrypt, which on macOS stores its symmetric encryption key in the system Keychain under an entry tied to the app's code signature. This provides:

- **Zero additional dependencies** — ships with Electron.
- **No user interaction** — the Keychain is unlocked when the user is logged in. No master password prompts.
- **Per-app isolation** — other apps cannot read the Keychain entry without explicit user grant.
- **Industry standard** — VS Code, Signal Desktop, Element Desktop, and Ray all use this pattern.

Alternatives rejected:

- **`keytar`**: Archived Dec 2022, no security patches, native module build pain.
- **`electron-store` built-in encryption**: Fundamentally broken — the encryption key is embedded in the app bundle.
- **Environment variables**: Leaves secrets in plaintext. No UI path.

### Validation Strategy

- **Per-field on write**: The schema's Zod validator runs on every `set()` call. Type mismatches and constraint violations are rejected immediately.
- **Cross-field at point of use**: Subsystems validate their own invariants when they consume config (e.g., the LLM module checks that an API key is present when the provider requires one). The config store does not enforce cross-field constraints — this avoids building a constraint solver for what is currently one case.

### Agent Tool Interface

The configuration store is exposed to agents via IPC tool calls:

- `config:set(key, value)` — validates against schema, encrypts if sensitive, persists.
- `config:get(key)` — returns the current value. **Sensitive keys return `null`** to agents; only the main process and renderer (via IPC) can read decrypted secrets.
- `config:getSchema` — returns the full schema (without values) for discovery.

This lets an agent help configure the app ("set my API key to ...") while preventing secrets from leaking into LLM context on read.

### UI Generation

The renderer reads the schema via `config:getSchema` and generates a settings form automatically. Schema metadata maps to widgets:

| Schema property               | Widget                               |
| ----------------------------- | ------------------------------------ |
| `string` + `sensitive`        | Password input with show/hide toggle |
| `enum` / `string` + `options` | Select dropdown                      |
| `boolean`                     | Toggle switch                        |
| `number`                      | Number input                         |
| `string` (plain)              | Text input                           |

Grouping comes from the `group` field. Adding a new config key requires only a schema entry — no UI code changes.

## Consequences

### Positive

- **Minimal friction**: Users configure the app through a settings UI, not env vars.
- **Secrets are encrypted at rest** via OS-native Keychain integration.
- **Schema-driven**: Adding new settings requires one schema entry. UI, validation, agent tools, and storage all derive from it.
- **Type-safe reads**: `get('llm.model')` returns `string`, not `unknown`, derived from the schema.
- **Agent-friendly**: External tools can discover and modify configuration programmatically.

### Negative

- **Code-signing sensitivity**: During development without proper code signing, macOS may prompt for Keychain access on rebuild. Proper signing eliminates this.
- **Single file**: If the config file is corrupted, all settings (including encrypted secrets) are lost. Mitigated by the file being small and rarely written.
- **No env var fallback**: Dropping env var support means existing developer workflows change. This is intentional — we want one canonical configuration path.

### Neutral

- The LLM provider module (`src/main/llm/provider.ts`) will switch from reading `process.env` to reading from the config store. This is a straightforward refactor.
- The existing `llm:checkHealth` IPC handler can be replaced or supplemented by checking `config:get('llm.apiKey')`.

## Related

- ADR 002: Vercel AI SDK for provider abstraction
- ADR 010: OpenRouter as default provider (references env vars — superseded for configuration mechanism, not provider choice)
- T-002: LLM Integration Setup (requirement §6 partially addressed)
- SPEC §9.1: "User preferences (if any emerge)"
