import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { configStore } from '../config'

export interface ValidateModelResult {
  valid: boolean
  error?: string
}

function classifyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()

  if (
    lower.includes('401') ||
    lower.includes('unauthorized') ||
    lower.includes('invalid api key')
  ) {
    return 'Invalid API key'
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return 'Model not found'
  }
  if (lower.includes('429') || lower.includes('rate limit')) {
    return 'Rate limited — try again later'
  }
  return `Validation failed: ${message.slice(0, 120)}`
}

/**
 * Validate a model name by making a minimal test call through the configured provider.
 * Tests both the API key and model access in one shot.
 */
export async function validateModel(model: string): Promise<ValidateModelResult> {
  const apiKey = configStore.get('llm.apiKey')

  if (!apiKey) {
    return { valid: false, error: 'API key is not configured' }
  }

  try {
    const openrouter = createOpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1'
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    await generateText({ model: openrouter(model), prompt: 'Hi', maxTokens: 1 } as any)
    return { valid: true }
  } catch (error) {
    return { valid: false, error: classifyError(error) }
  }
}
