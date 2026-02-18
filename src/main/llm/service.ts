import { generateText, streamText } from 'ai'
import type { ModelMessage } from 'ai'
import { z } from 'zod'
import { createProvider } from './provider'
import { trackAsync } from '../debug'

export interface GenerateTextOptions {
  system?: string
  prompt: string
  messages?: ModelMessage[]
}

export interface GenerateObjectOptions<T extends z.ZodType> {
  system?: string
  prompt: string
  schema: T
}

export interface StreamTextOptions {
  system?: string
  messages: ModelMessage[]
}

async function generateImpl(options: GenerateTextOptions): Promise<string> {
  try {
    const model = createProvider()

    // Create params conditionally to handle exactOptionalPropertyTypes
    const params: {
      model: ReturnType<typeof createProvider>
      system?: string
      prompt: string
      messages?: ModelMessage[]
    } = {
      model,
      prompt: options.prompt
    }

    if (options.system !== undefined) {
      params.system = options.system
    }

    if (options.messages !== undefined) {
      params.messages = options.messages
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    const result = await generateText(params as any)

    return result.text
  } catch (error) {
    console.error('LLM generateText error:', error)
    throw new Error(
      `Failed to generate text: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Generate text completion using the configured LLM provider.
 * For one-shot completions without structured output.
 */
export const generate = trackAsync(
  'llm:generate',
  (options: GenerateTextOptions) => options.prompt.slice(0, 60),
  generateImpl
)

async function generateStructuredImpl<T extends z.ZodType>(
  options: GenerateObjectOptions<T>
): Promise<z.infer<T>> {
  try {
    const model = createProvider()

    const params: {
      model: ReturnType<typeof createProvider>
      system?: string
      prompt: string
      output: 'object'
      schema: T
    } = {
      model,
      prompt: options.prompt,
      output: 'object',
      schema: options.schema
    }

    if (options.system !== undefined) {
      params.system = options.system
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    const result = await generateText(params as any)

    // Type assertion is safe because generateText with output:'object' returns an object property
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    return (result as any).output as z.infer<T>
  } catch (error) {
    console.error('LLM generateObject error:', error)
    throw new Error(
      `Failed to generate structured output: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Generate structured output using Zod schema validation.
 * Returns a typed object parsed from LLM response.
 */
export async function generateStructured<T extends z.ZodType>(
  options: GenerateObjectOptions<T>
): Promise<z.infer<T>> {
  const tracked = trackAsync(
    'llm:generateStructured',
    (o: GenerateObjectOptions<T>) => o.prompt.slice(0, 60),
    generateStructuredImpl<T>
  )
  return tracked(options)
}

/**
 * Stream text responses for chat-like interfaces.
 * Returns an async iterable of text chunks.
 */
export function stream(options: StreamTextOptions): AsyncIterable<string> {
  try {
    const model = createProvider()

    const params: Parameters<typeof streamText>[0] = {
      model,
      messages: options.messages
    }

    if (options.system !== undefined) {
      params.system = options.system
    }

    const result = streamText(params)

    return result.textStream
  } catch (error) {
    console.error('LLM streamText error:', error)
    throw new Error(
      `Failed to stream text: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
