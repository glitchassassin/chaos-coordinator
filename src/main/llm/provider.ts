import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

export interface LLMConfig {
  provider: 'openrouter' // Can extend to support more providers
  apiKey: string
  model: string
}

/**
 * Get LLM configuration from environment variables.
 * Priority: process.env.OPENROUTER_API_KEY
 */
export function getConfig(): LLMConfig {
  const apiKey = process.env.OPENROUTER_API_KEY

  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY environment variable is not set. Please configure your API key.'
    )
  }

  return {
    provider: 'openrouter',
    apiKey,
    model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet'
  }
}

/**
 * Create and configure the LLM provider instance.
 * Uses OpenRouter by default as per ADR 010.
 * OpenRouter provides access to multiple LLM providers through a unified API.
 */
export function createProvider(): LanguageModel {
  const config = getConfig()

  // OpenRouter uses OpenAI-compatible API with custom base URL
  const openrouter = createOpenAI({
    apiKey: config.apiKey,
    baseURL: 'https://openrouter.ai/api/v1'
  })

  return openrouter(config.model)
}
