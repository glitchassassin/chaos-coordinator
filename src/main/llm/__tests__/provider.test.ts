import { describe, it, expect, beforeEach, vi } from 'vitest'
import { join } from 'path'
import { tmpdir } from 'os'

// Mock Electron modules before importing provider
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => join(tmpdir(), 'chaos-coordinator-test')),
    isReady: vi.fn(() => true),
    whenReady: vi.fn(() => Promise.resolve())
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((value: string) => Buffer.from(value, 'utf-8')),
    decryptString: vi.fn((buffer: Buffer) => buffer.toString('utf-8'))
  }
}))

import { getConfig, createProvider } from '../provider'
import { configStore } from '../../config'

describe('LLM Provider', () => {
  beforeEach(() => {
    // Initialize config store
    configStore.initialize()
    // Reset all config values by clearing the cache
    configStore.reset('llm.apiKey')
    configStore.reset('llm.model')
    configStore.reset('llm.provider')
  })

  describe('getConfig', () => {
    it('throws error when API key is not configured', () => {
      expect(() => getConfig()).toThrow(
        'LLM API key is not configured. Please set it in Settings.'
      )
    })

    it('returns configuration from config store', () => {
      // Set values in config store
      configStore.set('llm.apiKey', 'test-api-key')
      configStore.set('llm.model', 'openai/gpt-4')

      const config = getConfig()

      expect(config.provider).toBe('openrouter')
      expect(config.apiKey).toBe('test-api-key')
      expect(config.model).toBe('openai/gpt-4')
    })

    it('uses default model when not explicitly configured', () => {
      configStore.set('llm.apiKey', 'test-api-key')
      // Don't set model - should use default

      const config = getConfig()

      expect(config.model).toBe('anthropic/claude-3.5-sonnet')
    })
  })

  describe('createProvider', () => {
    it('creates OpenRouter provider when configured', () => {
      configStore.set('llm.apiKey', 'test-api-key')

      const provider = createProvider()

      expect(provider).toBeDefined()
      // Provider is a LanguageModel instance
      expect(provider).toHaveProperty('doGenerate')
    })

    it('throws error when API key is not configured', () => {
      expect(() => createProvider()).toThrow(
        'LLM API key is not configured. Please set it in Settings.'
      )
    })
  })
})
