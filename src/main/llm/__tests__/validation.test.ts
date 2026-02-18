/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/test-config'),
    isReady: vi.fn(() => true),
    whenReady: vi.fn(() => Promise.resolve())
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false),
    encryptString: vi.fn((v: string) => Buffer.from(v)),
    decryptString: vi.fn((b: Buffer) => b.toString())
  }
}))

vi.mock('ai', () => ({
  generateText: vi.fn()
}))

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => vi.fn(() => ({ id: 'mock-model' })))
}))

vi.mock('../../../main/debug', () => ({
  trackAsync: vi.fn((_type: string, _label: unknown, fn: unknown) => fn)
}))

// Mock configStore
vi.mock('../../config', () => ({
  configStore: {
    get: vi.fn()
  }
}))

import * as aiModule from 'ai'
import { configStore } from '../../config'
import { validateModel } from '../validation'

describe('validateModel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns invalid when API key is not configured', async () => {
    vi.mocked(configStore.get).mockReturnValue(undefined as never)

    const result = await validateModel('anthropic/claude-3.5-sonnet')

    expect(result).toEqual({ valid: false, error: 'API key is not configured' })
    expect(aiModule.generateText).not.toHaveBeenCalled()
  })

  it('returns valid on successful call', async () => {
    vi.mocked(configStore.get).mockReturnValue('test-key' as never)
    vi.mocked(aiModule.generateText).mockResolvedValue({ text: 'Hi' } as never)

    const result = await validateModel('anthropic/claude-3.5-sonnet')

    expect(result).toEqual({ valid: true })
  })

  it('classifies 401 error as Invalid API key', async () => {
    vi.mocked(configStore.get).mockReturnValue('bad-key' as never)
    vi.mocked(aiModule.generateText).mockRejectedValue(new Error('401 Unauthorized'))

    const result = await validateModel('anthropic/claude-3.5-sonnet')

    expect(result.valid).toBe(false)
    expect(result.error).toBe('Invalid API key')
  })

  it('classifies 404 error as Model not found', async () => {
    vi.mocked(configStore.get).mockReturnValue('test-key' as never)
    vi.mocked(aiModule.generateText).mockRejectedValue(new Error('404 not found'))

    const result = await validateModel('invalid/model-name')

    expect(result.valid).toBe(false)
    expect(result.error).toBe('Model not found')
  })

  it('classifies 429 error as Rate limited', async () => {
    vi.mocked(configStore.get).mockReturnValue('test-key' as never)
    vi.mocked(aiModule.generateText).mockRejectedValue(
      new Error('429 rate limit exceeded')
    )

    const result = await validateModel('anthropic/claude-3.5-sonnet')

    expect(result.valid).toBe(false)
    expect(result.error).toBe('Rate limited — try again later')
  })

  it('returns generic message for unknown errors', async () => {
    vi.mocked(configStore.get).mockReturnValue('test-key' as never)
    vi.mocked(aiModule.generateText).mockRejectedValue(new Error('Network timeout'))

    const result = await validateModel('anthropic/claude-3.5-sonnet')

    expect(result.valid).toBe(false)
    expect(result.error).toContain('Validation failed')
    expect(result.error).toContain('Network timeout')
  })
})
