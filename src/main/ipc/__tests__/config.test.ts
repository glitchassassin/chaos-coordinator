/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ipcMain } from 'electron'
import { registerConfigHandlers } from '../config'
import { configStore } from '../../config'

// Mock Electron modules
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  },
  app: {
    getPath: vi.fn(() => '/tmp/test'),
    isReady: vi.fn(() => true),
    whenReady: vi.fn(() => Promise.resolve())
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((value: string) => Buffer.from(value, 'utf-8')),
    decryptString: vi.fn((buffer: Buffer) => buffer.toString('utf-8'))
  }
}))

describe('Config IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    configStore.initialize()
  })

  it('registers config:get handler', () => {
    registerConfigHandlers()

    expect(ipcMain.handle).toHaveBeenCalledWith('config:get', expect.any(Function))
  })

  it('registers config:set handler', () => {
    registerConfigHandlers()

    expect(ipcMain.handle).toHaveBeenCalledWith('config:set', expect.any(Function))
  })

  it('registers config:getAll handler', () => {
    registerConfigHandlers()

    expect(ipcMain.handle).toHaveBeenCalledWith('config:getAll', expect.any(Function))
  })

  it('registers config:getSchema handler', () => {
    registerConfigHandlers()

    expect(ipcMain.handle).toHaveBeenCalledWith('config:getSchema', expect.any(Function))
  })

  it('registers config:reset handler', () => {
    registerConfigHandlers()

    expect(ipcMain.handle).toHaveBeenCalledWith('config:reset', expect.any(Function))
  })

  it('config:get returns value from store', () => {
    registerConfigHandlers()

    // Get the handler function
    const calls = vi.mocked(ipcMain.handle).mock.calls
    const getHandler = calls.find((call) => call[0] === 'config:get')?.[1]

    expect(getHandler).toBeDefined()

    // Set a value
    configStore.set('llm.model', 'test-model')

    // Call the handler
    const result = getHandler?.({} as Electron.IpcMainInvokeEvent, { key: 'llm.model' })

    expect(result).toBe('test-model')
  })

  it('config:set stores value', () => {
    registerConfigHandlers()

    // Get the handler function
    const calls = vi.mocked(ipcMain.handle).mock.calls
    const setHandler = calls.find((call) => call[0] === 'config:set')?.[1]

    expect(setHandler).toBeDefined()

    // Call the handler
    const result = setHandler?.({} as Electron.IpcMainInvokeEvent, {
      key: 'llm.model',
      value: 'new-model'
    })

    expect(result).toBe(true)
    expect(configStore.get('llm.model')).toBe('new-model')
  })

  it('config:getAll returns masked config', () => {
    registerConfigHandlers()

    // Get the handler function
    const calls = vi.mocked(ipcMain.handle).mock.calls
    const getAllHandler = calls.find((call) => call[0] === 'config:getAll')?.[1]

    expect(getAllHandler).toBeDefined()

    // Set some values
    configStore.set('llm.apiKey', 'secret-key')
    configStore.set('llm.model', 'test-model')

    // Call the handler
    const result = getAllHandler?.({} as Electron.IpcMainInvokeEvent) as Record<
      string,
      string
    >

    expect(result['llm.apiKey']).toBe('***')
    expect(result['llm.model']).toBe('test-model')
  })

  it('config:getSchema returns schema metadata', () => {
    registerConfigHandlers()

    // Get the handler function
    const calls = vi.mocked(ipcMain.handle).mock.calls
    const getSchemaHandler = calls.find((call) => call[0] === 'config:getSchema')?.[1]

    if (!getSchemaHandler) {
      throw new Error('config:getSchema handler not found')
    }

    // Call the handler
    const result = getSchemaHandler({} as Electron.IpcMainInvokeEvent) as Record<
      string,
      { label: string; group: string }
    >

    const apiKeyMeta = result['llm.apiKey']
    expect(apiKeyMeta).toBeDefined()
    if (apiKeyMeta) {
      expect(apiKeyMeta.label).toBe('API Key')
      expect(apiKeyMeta.group).toBe('LLM')
    }
  })

  it('config:reset removes value from store', () => {
    registerConfigHandlers()

    // Get the handler function
    const calls = vi.mocked(ipcMain.handle).mock.calls
    const resetHandler = calls.find((call) => call[0] === 'config:reset')?.[1]

    if (!resetHandler) {
      throw new Error('config:reset handler not found')
    }

    // Set a value
    configStore.set('llm.model', 'custom-model')
    expect(configStore.get('llm.model')).toBe('custom-model')

    // Call the handler
    const result = resetHandler({} as Electron.IpcMainInvokeEvent, { key: 'llm.model' })

    expect(result).toBe(true)
    // Should return to default
    expect(configStore.get('llm.model')).toBe('anthropic/claude-3.5-sonnet')
  })
})
