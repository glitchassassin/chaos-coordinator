/* eslint-disable @typescript-eslint/unbound-method */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ConfigStore } from '../store'
import { existsSync, rmSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { safeStorage } from 'electron'

// Mock Electron modules
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

describe('ConfigStore', () => {
  let configPath: string
  let store: ConfigStore

  beforeEach(() => {
    // Create a temporary directory for test config
    const testDir = join(tmpdir(), 'chaos-coordinator-test')
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true })
    }
    configPath = join(testDir, 'config.json')

    // Clean up any existing config file from previous tests
    if (existsSync(configPath)) {
      rmSync(configPath)
    }

    // Reset mocks
    vi.clearAllMocks()
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true)

    store = new ConfigStore(configPath)
    store.initialize()
  })

  afterEach(() => {
    // Clean up test config file
    if (existsSync(configPath)) {
      rmSync(configPath)
    }
  })

  describe('get', () => {
    it('returns undefined for unset non-default keys', () => {
      const value: string | undefined = store.get('llm.apiKey')
      expect(value).toBeUndefined()
    })

    it('returns default value for unset keys with defaults', () => {
      const value: string | undefined = store.get('llm.model')
      expect(value).toBe('anthropic/claude-3.5-sonnet')
    })

    it('returns stored value when set', () => {
      store.set('llm.apiKey', 'test-key')
      const value: string | undefined = store.get('llm.apiKey')
      expect(value).toBe('test-key')
    })
  })

  describe('set', () => {
    it('stores a plain value', () => {
      store.set('llm.model', 'custom-model')
      expect(store.get('llm.model')).toBe('custom-model')
    })

    it('stores a sensitive value (encrypted)', () => {
      store.set('llm.apiKey', 'secret-key')
      expect(store.get('llm.apiKey')).toBe('secret-key')
      expect(safeStorage.encryptString).toHaveBeenCalledWith('secret-key')
    })

    it('validates against schema', () => {
      expect(() => {
        store.set('llm.apiKey', '')
      }).toThrow(/Invalid value/)
    })

    it('throws when encryption unavailable for sensitive values', () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false)
      const storeNoEncrypt = new ConfigStore(configPath)
      storeNoEncrypt.initialize()

      expect(() => {
        storeNoEncrypt.set('llm.apiKey', 'test-key')
      }).toThrow(/encryption is not available/)
    })
  })

  describe('reset', () => {
    it('removes stored value', () => {
      store.set('llm.apiKey', 'test-key')
      expect(store.get('llm.apiKey')).toBe('test-key')

      store.reset('llm.apiKey')
      expect(store.get('llm.apiKey')).toBeUndefined()
    })

    it('restores default value for keys with defaults', () => {
      store.set('llm.model', 'custom-model')
      expect(store.get('llm.model')).toBe('custom-model')

      store.reset('llm.model')
      expect(store.get('llm.model')).toBe('anthropic/claude-3.5-sonnet')
    })
  })

  describe('getAll', () => {
    it('returns all values with sensitive ones masked', () => {
      store.set('llm.apiKey', 'secret')
      store.set('llm.model', 'custom-model')

      const all = store.getAll()

      expect(all['llm.apiKey' as const]).toBe('***')
      expect(all['llm.model' as const]).toBe('custom-model')
      expect(all['llm.provider' as const]).toBe('openrouter') // default value
    })

    it('omits undefined values', () => {
      const all = store.getAll()
      expect('llm.apiKey' in all).toBe(false) // no default, not set
    })
  })

  describe('persistence', () => {
    it('persists values across instances', () => {
      store.set('llm.apiKey', 'test-key')
      store.set('llm.model', 'custom-model')

      // Create a new store instance
      const newStore = new ConfigStore(configPath)
      newStore.initialize()

      expect(newStore.get('llm.apiKey')).toBe('test-key')
      expect(newStore.get('llm.model')).toBe('custom-model')
    })

    it('decrypts sensitive values on load', () => {
      store.set('llm.apiKey', 'encrypted-key')

      // Create a new store instance to trigger load
      const newStore = new ConfigStore(configPath)
      newStore.initialize()

      expect(newStore.get('llm.apiKey')).toBe('encrypted-key')
      expect(safeStorage.decryptString).toHaveBeenCalled()
    })
  })
})
