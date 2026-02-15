import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
import { configStore } from '../config'

export interface LLMConfig {
  provider: 'openrouter' // Can extend to support more providers
  apiKey: string
  model: string
}

/**
 * Get LLM configuration from the config store.
 */
export function getConfig(): LLMConfig {
  const apiKey = configStore.get('llm.apiKey')

  if (!apiKey) {
    throw new Error('LLM API key is not configured. Please set it in Settings.')
  }

  return {
    provider: configStore.get('llm.provider'),
    apiKey,
    model: configStore.get('llm.model')
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
