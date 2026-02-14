# ADR 010: OpenRouter as Default LLM Provider

**Status:** Accepted
**Date:** 2026-02-14

## Context

Following ADR 002's decision to use Vercel AI SDK for provider abstraction, we need to choose a default LLM provider for the initial implementation. While the abstraction allows users to swap providers, the default choice impacts developer experience, cost management, and experimentation capabilities.

Key requirements for the default provider:

- Access to high-quality models (Claude, GPT-4, etc.)
- Cost-effective options for development and testing
- Ability to experiment with different model sizes and capabilities
- Path toward eventual local model support
- Simple setup for developers

## Decision

Use **OpenRouter** as the default LLM provider instead of direct Anthropic API access.

OpenRouter is a unified API that provides access to multiple LLM providers (Anthropic, OpenAI, Google, Meta, and many others) through a single endpoint and API key. It acts as an intelligent router and aggregator.

### Configuration

- Environment variable: `OPENROUTER_API_KEY`
- Default model: `anthropic/claude-3.5-sonnet` (configurable via `OPENROUTER_MODEL`)
- Supports all models available through OpenRouter's API

## Rationale

**1. Model Flexibility**

- Access to 100+ models from different providers through one API
- Can switch between Claude 3.5 Sonnet, GPT-4, Llama 3, Gemini, and others without code changes
- Experiment with different models for different use cases (cheaper models for simple tasks, powerful models for complex reasoning)

**2. Cost Management**

- Access to lower-cost alternatives (e.g., Claude 3 Haiku, GPT-3.5, Llama 3 8B)
- Pay only for what you use across all providers
- Easier to optimize costs by testing different model tiers
- Volume discounts apply across all model usage

**3. Path to Local Models**

- OpenRouter supports running local models through providers like Together AI and Fireworks
- Eventually can point to locally-hosted models via OpenRouter-compatible endpoints
- Reduces lock-in to cloud providers

**4. Developer Experience**

- Single API key for all providers
- Consistent API across different models
- Built-in rate limiting and load balancing
- Good documentation and model comparison tools

**5. Vercel AI SDK Support**

- Native OpenRouter support via `@ai-sdk/openrouter` package
- Same interface as other providers (Anthropic, OpenAI)
- Minimal code changes from our current implementation

## Alternatives Considered

**Direct Anthropic API**

- ✅ Direct access, no middleman
- ❌ Single provider lock-in
- ❌ Higher costs for experimentation
- ❌ Requires separate APIs for other models
- ❌ No built-in fallback options

**Direct OpenAI API**

- ✅ Industry standard, well-documented
- ❌ Limited to OpenAI models only
- ❌ More expensive than OpenRouter for same models
- ❌ No access to Claude or other providers

**LiteLLM Proxy**

- ✅ Self-hosted option for privacy
- ✅ Similar multi-provider support
- ❌ Requires self-hosting infrastructure
- ❌ More complex setup for developers
- ❌ Additional maintenance burden

## Consequences

### Positive

- **Development velocity:** Can quickly try different models without API credential juggling
- **Cost optimization:** Easy to find the right balance of cost/quality for each feature
- **Future-proofing:** Path to local models and new providers as they emerge
- **Fallback resilience:** Can configure fallback models if primary is unavailable
- **Single bill:** Unified billing across all LLM usage

### Negative

- **Slight latency overhead:** Extra hop through OpenRouter's infrastructure (typically <50ms)
- **API key management:** Developers need an OpenRouter account instead of direct provider access
- **Feature lag:** New provider features may take time to appear in OpenRouter
- **Rate limits:** Subject to OpenRouter's rate limits on top of provider limits
- **Privacy consideration:** Requests go through OpenRouter's infrastructure (though they claim not to log prompts)

### Neutral

- Still uses Vercel AI SDK abstraction, so switching to direct providers later is straightforward
- OpenRouter API key is free to obtain and has generous free tier for testing
- Can override with direct provider credentials if needed for specific use cases

## Implementation Notes

- Replace `@ai-sdk/anthropic` with `@ai-sdk/openrouter`
- Update environment variable from `ANTHROPIC_API_KEY` to `OPENROUTER_API_KEY`
- Update config to include model selection (defaults to `anthropic/claude-3.5-sonnet`)
- Update documentation with OpenRouter setup instructions
- Tests can mock the provider, so no test changes needed

## Related

- ADR 002: Established Vercel AI SDK for provider abstraction
- Task T-002: LLM Integration Setup implementation
