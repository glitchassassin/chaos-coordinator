---
id: T-002
title: 'LLM Integration Setup'
status: ready
priority: 1
dependencies: []
spec_refs: ['§10.3']
adrs: ['002']
estimated_complexity: M
tags: [core, infrastructure]
created: 2026-02-14
updated: 2026-02-14
---

# T-002: LLM Integration Setup

## Context

Multiple features in Chaos Coordinator depend on LLM access: context summary generation (intake and shelving), natural language trigger interpretation, chat interface responses, and command safety classification. This task establishes the foundational LLM integration layer that all those features build on.

ADR 002 selected Vercel AI SDK for its provider-agnostic design. The `ai` package is already in `package.json` but no integration code exists yet.

## Requirements

1. **Create an LLM service module** in the main process that provides a consistent interface for all LLM consumers in the app.

2. **Provider configuration**: Support at least one provider out of the box (Anthropic recommended, since the user has Claude). Allow switching providers via configuration without changing consumer code.

3. **Structured output support**: Several consumers need structured responses (e.g., context capture returns a specific format, command safety returns a classification enum). The service should support both freeform text generation and structured/typed output.

4. **Streaming support**: The chat interface will need streaming responses. The service should support both streaming and non-streaming calls.

5. **Error handling**: Graceful degradation when the LLM is unavailable — features that depend on LLM should fall back to manual input rather than crashing.

6. **Configuration storage**: API keys and provider preferences should be stored securely. At minimum, support environment variables and a config file. Do not hardcode keys.

7. **Expose via IPC**: Renderer processes need to invoke LLM operations. Create IPC channels for the operations that the renderer will need (at minimum: generate text, generate structured output, stream text).

## Existing Code

- **Package already installed**: `ai` (Vercel AI SDK) is in `package.json`
- **Provider packages**: Check if `@ai-sdk/anthropic` or similar provider packages are installed; install if missing.
- **IPC registration**: `src/main/ipc/index.ts` — register new LLM handlers here
- **IPC type map**: `src/shared/types/ipc.ts` — add LLM channel types
- **Preload**: `src/preload/index.ts` — expose LLM API to renderer

## Implementation Notes

- **Module location**: Create `src/main/llm/` directory with:
  - `provider.ts` — provider setup and configuration (reads API key from env/config)
  - `service.ts` — high-level functions consumed by other modules (generateContext, classifyCommand, interpretTrigger, chat)
  - `index.ts` — public API re-exports
- **Vercel AI SDK usage**: Use `generateText()` for one-shot completions, `streamText()` for chat streaming, and `generateObject()` with Zod schemas for structured output.
- **System prompts**: Each consumer (context capture, trigger interpretation, etc.) will need its own system prompt. Store these as constants in the relevant consumer modules, not in the LLM service itself. The service should accept system prompts as parameters.
- **API key handling**: Read from `process.env.ANTHROPIC_API_KEY` (or equivalent for the provider). Optionally support a config file at the app's userData path. The app should show a clear error state if no API key is configured.
- **Do NOT implement consumer-specific logic here** — this task only sets up the infrastructure. The specific prompts, schemas, and flows for context capture, trigger interpretation, etc. are in their respective tasks (T-007, T-008, T-009, T-010, T-011).

## Testing Requirements

**Coverage target: 80% line coverage.**

Test in the `node` Vitest project.

1. **Provider initialization**: Test that the provider is created correctly with valid config, and errors gracefully with missing config.
2. **Service functions**: Mock the Vercel AI SDK calls. Test that `generateText`, `generateObject`, and `streamText` wrappers correctly pass through parameters and handle responses.
3. **Error handling**: Test fallback behavior when the LLM call fails (network error, rate limit, invalid response).
4. **IPC handlers**: Test that IPC channels correctly route to service functions.

## Documentation

- Add a section to `docs/ARCHITECTURE.md` describing the LLM integration layer, how to configure a provider, and how consumer modules use it.
- Document the API key setup in a developer getting-started guide (or add to the existing README if one exists).

## Verification

1. Run `npm run test` — LLM integration tests pass.
2. Set an API key via environment variable, run `npm run dev`.
3. Open the dev console — verify the LLM service initializes without errors.
4. (Detailed verification deferred to consumer tasks T-007 through T-011.)
