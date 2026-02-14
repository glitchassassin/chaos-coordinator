/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ipcMain } from 'electron'
import { registerLLMHandlers } from '../llm'
import * as llmService from '../../llm/service'
import * as llmProvider from '../../llm/provider'

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  }
}))

// Mock LLM modules
vi.mock('../../llm/service', () => ({
  generate: vi.fn(),
  generateStructured: vi.fn()
}))

vi.mock('../../llm/provider', () => ({
  getConfig: vi.fn()
}))

describe('LLM IPC Handlers', () => {
  let handlers: Map<string, (...args: unknown[]) => unknown>

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = new Map()

    // Capture IPC handlers
    vi.mocked(ipcMain.handle).mockImplementation((channel, handler) => {
      handlers.set(channel, handler as (...args: unknown[]) => unknown)
      return undefined as never
    })

    registerLLMHandlers()
  })

  afterEach(() => {
    handlers.clear()
  })

  describe('llm:generate', () => {
    it('registers the handler', () => {
      const mockedHandle = vi.mocked(ipcMain.handle)
      expect(mockedHandle).toHaveBeenCalledWith('llm:generate', expect.any(Function))
    })

    it('generates text from prompt', async () => {
      const mockedGenerate = vi.mocked(llmService.generate)
      mockedGenerate.mockResolvedValue('Generated text')

      const handler = handlers.get('llm:generate')
      expect(handler).toBeDefined()
      if (handler) {
        const result = await handler({}, { prompt: 'Test prompt' })
        expect(result).toBe('Generated text')
      }

      expect(mockedGenerate).toHaveBeenCalledWith({
        prompt: 'Test prompt',
        system: undefined
      })
    })

    it('passes system message when provided', async () => {
      const mockedGenerate = vi.mocked(llmService.generate)
      mockedGenerate.mockResolvedValue('Generated text')

      const handler = handlers.get('llm:generate')
      expect(handler).toBeDefined()
      if (handler) {
        await handler({}, { system: 'You are helpful', prompt: 'Test prompt' })
      }

      expect(mockedGenerate).toHaveBeenCalledWith({
        system: 'You are helpful',
        prompt: 'Test prompt'
      })
    })
  })

  describe('llm:generateStructured', () => {
    it('registers the handler', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith(
        'llm:generateStructured',
        expect.any(Function)
      )
    })

    it('generates structured output from schema', async () => {
      const expectedOutput = { title: 'Test', priority: 1 }
      const mockedGenerate = vi.mocked(llmService.generateStructured)
      mockedGenerate.mockResolvedValue(expectedOutput)

      const handler = handlers.get('llm:generateStructured')
      expect(handler).toBeDefined()
      const schemaJson = JSON.stringify({
        title: { type: 'string' },
        priority: { type: 'number' }
      })

      if (handler) {
        const result = await handler({}, { prompt: 'Generate task', schema: schemaJson })
        expect(result).toEqual(expectedOutput)
      }

      expect(mockedGenerate).toHaveBeenCalled()
    })
  })

  describe('llm:checkHealth', () => {
    it('registers the handler', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('llm:checkHealth', expect.any(Function))
    })

    it('returns configured:true when API key is set', async () => {
      vi.mocked(llmProvider.getConfig).mockReturnValue({
        provider: 'anthropic',
        apiKey: 'test-key',
        model: 'claude-sonnet-4-5-20250929'
      })

      const handler = handlers.get('llm:checkHealth')
      expect(handler).toBeDefined()
      if (handler) {
        const result = await handler({})
        expect(result).toEqual({ configured: true })
      }
    })

    it('returns configured:false when API key is not set', async () => {
      vi.mocked(llmProvider.getConfig).mockImplementation(() => {
        throw new Error('API key not set')
      })

      const handler = handlers.get('llm:checkHealth')
      expect(handler).toBeDefined()
      if (handler) {
        const result = await handler({})
        expect(result).toEqual({ configured: false })
      }
    })
  })
})
