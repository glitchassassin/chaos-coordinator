import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getConfig, createProvider } from '../provider'

describe('LLM Provider', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('getConfig', () => {
    it('reads API key from OPENROUTER_API_KEY environment variable', () => {
      process.env.OPENROUTER_API_KEY = 'test-api-key'

      const config = getConfig()

      expect(config.provider).toBe('openrouter')
      expect(config.apiKey).toBe('test-api-key')
    })

    it('uses default model when OPENROUTER_MODEL is not set', () => {
      process.env.OPENROUTER_API_KEY = 'test-api-key'
      delete process.env.OPENROUTER_MODEL

      const config = getConfig()

      expect(config.model).toBe('anthropic/claude-3.5-sonnet')
    })

    it('uses custom model when OPENROUTER_MODEL is set', () => {
      process.env.OPENROUTER_API_KEY = 'test-api-key'
      process.env.OPENROUTER_MODEL = 'openai/gpt-4'

      const config = getConfig()

      expect(config.model).toBe('openai/gpt-4')
    })

    it('throws error when API key is not set', () => {
      delete process.env.OPENROUTER_API_KEY

      expect(() => getConfig()).toThrow(
        'OPENROUTER_API_KEY environment variable is not set. Please configure your API key.'
      )
    })
  })

  describe('createProvider', () => {
    it('creates OpenRouter provider when configured', () => {
      process.env.OPENROUTER_API_KEY = 'test-api-key'

      const provider = createProvider()

      expect(provider).toBeDefined()
      // Provider is a LanguageModel instance
      expect(provider).toHaveProperty('doGenerate')
    })

    it('throws error when API key is not configured', () => {
      delete process.env.OPENROUTER_API_KEY

      expect(() => createProvider()).toThrow('OPENROUTER_API_KEY')
    })
  })
})
