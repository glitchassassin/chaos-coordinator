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
    it('reads API key from ANTHROPIC_API_KEY environment variable', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key'

      const config = getConfig()

      expect(config.provider).toBe('anthropic')
      expect(config.apiKey).toBe('test-api-key')
    })

    it('uses default model when ANTHROPIC_MODEL is not set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key'
      delete process.env.ANTHROPIC_MODEL

      const config = getConfig()

      expect(config.model).toBe('claude-sonnet-4-5-20250929')
    })

    it('uses custom model when ANTHROPIC_MODEL is set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key'
      process.env.ANTHROPIC_MODEL = 'claude-opus-4-6'

      const config = getConfig()

      expect(config.model).toBe('claude-opus-4-6')
    })

    it('throws error when API key is not set', () => {
      delete process.env.ANTHROPIC_API_KEY

      expect(() => getConfig()).toThrow(
        'ANTHROPIC_API_KEY environment variable is not set. Please configure your API key.'
      )
    })
  })

  describe('createProvider', () => {
    it('creates Anthropic provider when configured', () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key'

      const provider = createProvider()

      expect(provider).toBeDefined()
      // Provider is a LanguageModel instance
      expect(provider).toHaveProperty('doGenerate')
    })

    it('throws error when API key is not configured', () => {
      delete process.env.ANTHROPIC_API_KEY

      expect(() => createProvider()).toThrow('ANTHROPIC_API_KEY')
    })
  })
})
