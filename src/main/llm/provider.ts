import { createAnthropic } from '@ai-sdk/anthropic'
import type { LanguageModel } from 'ai'

export interface LLMConfig {
  provider: 'anthropic' // Can extend to support more providers
  apiKey: string
  model: string
}

/**
 * Get LLM configuration from environment variables.
 * Priority: process.env.ANTHROPIC_API_KEY
 */
export function getConfig(): LLMConfig {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is not set. Please configure your API key.'
    )
  }

  return {
    provider: 'anthropic',
    apiKey,
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929'
  }
}

/**
 * Create and configure the LLM provider instance.
 * Uses Anthropic by default as per ADR 002.
 */
export function createProvider(): LanguageModel {
  const config = getConfig()

  // Currently only Anthropic is supported
  const client = createAnthropic({
    apiKey: config.apiKey
  })
  return client(config.model)
}
