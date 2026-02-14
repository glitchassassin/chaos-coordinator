# ADR 002: Configurable LLM Provider via Vercel AI SDK

**Status:** Superseded by ADR 010
**Date:** 2026-02-13
**Updated:** 2026-02-14

## Context

The app requires LLM access for context summary generation, trigger interpretation, chat responses, and command safety classification. Hardcoding a single provider creates vendor lock-in and limits flexibility.

## Decision

Abstract LLM access behind the Vercel AI SDK, allowing swapping between Claude, OpenAI, local models, or other providers without code changes.

## Consequences

- **Flexibility:** Users can choose their preferred provider or use local models for privacy.
- **Abstraction cost:** Minor overhead from the abstraction layer, but Vercel AI SDK is well-maintained and widely adopted.
- **Testing:** Can swap to cheaper/faster models during development and testing.
- **Feature parity:** Some provider-specific features (tool use nuances, context window sizes) may require provider-aware logic in places.

## Superseded

This ADR established the pattern of using Vercel AI SDK for provider abstraction. See ADR 010 for the decision to use OpenRouter as the default provider implementation.
