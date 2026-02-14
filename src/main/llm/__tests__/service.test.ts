/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { z } from 'zod'
import { generate, generateStructured, stream } from '../service'
import * as aiModule from 'ai'

// Mock the ai module
vi.mock('ai', () => ({
  generateText: vi.fn(),
  streamText: vi.fn()
}))

// Mock the provider module
vi.mock('../provider', () => ({
  createProvider: vi.fn(() => ({
    modelId: 'claude-sonnet-4-5-20250929',
    doGenerate: vi.fn()
  }))
}))

describe('LLM Service', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: 'test-api-key' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('generate', () => {
    it('generates text from a simple prompt', async () => {
      const mockResult = { text: 'Generated response' }
      vi.mocked(aiModule.generateText).mockResolvedValue(mockResult as never)

      const result = await generate({
        prompt: 'Test prompt'
      })

      expect(result).toBe('Generated response')
      expect(aiModule.generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Test prompt'
        })
      )
    })

    it('includes system message when provided', async () => {
      const mockResult = { text: 'Generated response' }
      vi.mocked(aiModule.generateText).mockResolvedValue(mockResult as never)

      await generate({
        system: 'You are a helpful assistant',
        prompt: 'Test prompt'
      })

      expect(aiModule.generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are a helpful assistant',
          prompt: 'Test prompt'
        })
      )
    })

    it('includes messages when provided', async () => {
      const mockResult = { text: 'Generated response' }
      vi.mocked(aiModule.generateText).mockResolvedValue(mockResult as never)

      const messages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' }
      ]

      await generate({
        prompt: 'Test prompt',
        messages
      })

      expect(aiModule.generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Test prompt',
          messages
        })
      )
    })

    it('throws error when generation fails', async () => {
      vi.mocked(aiModule.generateText).mockRejectedValue(new Error('API error'))

      await expect(
        generate({
          prompt: 'Test prompt'
        })
      ).rejects.toThrow('Failed to generate text: API error')
    })
  })

  describe('generateStructured', () => {
    it('generates structured output with schema validation', async () => {
      const schema = z.object({
        title: z.string(),
        priority: z.number()
      })

      const mockResult = {
        output: { title: 'Task title', priority: 1 }
      }
      vi.mocked(aiModule.generateText).mockResolvedValue(mockResult as never)

      const result = await generateStructured({
        prompt: 'Generate a task',
        schema
      })

      expect(result).toEqual({ title: 'Task title', priority: 1 })
      expect(aiModule.generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Generate a task',
          output: 'object',
          schema
        })
      )
    })

    it('includes system message when provided', async () => {
      const schema = z.object({ value: z.string() })
      const mockResult = { output: { value: 'test' } }
      vi.mocked(aiModule.generateText).mockResolvedValue(mockResult as never)

      await generateStructured({
        system: 'You are a JSON generator',
        prompt: 'Generate data',
        schema
      })

      expect(aiModule.generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are a JSON generator',
          prompt: 'Generate data',
          output: 'object',
          schema
        })
      )
    })

    it('throws error when generation fails', async () => {
      const schema = z.object({ value: z.string() })
      vi.mocked(aiModule.generateText).mockRejectedValue(
        new Error('Schema validation failed')
      )

      await expect(
        generateStructured({
          prompt: 'Test prompt',
          schema
        })
      ).rejects.toThrow('Failed to generate structured output: Schema validation failed')
    })
  })

  describe('stream', () => {
    it('returns text stream for chat messages', async () => {
      async function* mockGenerator() {
        yield 'Hello'
        yield ' '
        yield 'world'
      }

      const textStream: AsyncGenerator<string> = mockGenerator() as never
      const mockResult = { textStream }
      vi.mocked(aiModule.streamText).mockReturnValue(mockResult as never)

      const messages = [{ role: 'user' as const, content: 'Hello' }]

      const result = stream({ messages })

      expect(result).toBeDefined()
      expect(aiModule.streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.any(Array)
        })
      )

      // Verify we can iterate the stream
      const chunks: string[] = []
      for await (const chunk of result) {
        chunks.push(chunk)
      }
      expect(chunks).toEqual(['Hello', ' ', 'world'])
    })

    it('includes system message when provided', () => {
      async function* mockGenerator() {
        yield 'test'
      }

      const textStream: AsyncGenerator<string> = mockGenerator() as never
      const mockResult = { textStream }
      vi.mocked(aiModule.streamText).mockReturnValue(mockResult as never)

      const messages = [{ role: 'user' as const, content: 'Hello' }]

      stream({
        system: 'You are helpful',
        messages
      })

      expect(aiModule.streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are helpful',
          messages: expect.any(Array)
        })
      )
    })

    it('throws error when streaming fails', () => {
      vi.mocked(aiModule.streamText).mockImplementation(() => {
        throw new Error('Network error')
      })

      const messages = [{ role: 'user' as const, content: 'Hello' }]

      expect(() => stream({ messages })).toThrow('Failed to stream text: Network error')
    })
  })
})
