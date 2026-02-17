/* eslint-disable @typescript-eslint/no-dynamic-delete */
/*
 * This file contains a generic configuration store with dynamic key access.
 * TypeScript's strict type checking cannot fully verify these patterns,
 * so we disable certain rules that would otherwise make this code impractical.
 */

import { app, safeStorage } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { CONFIG_SCHEMA } from '../../shared/config/schema'
import type {
  ConfigKey,
  ConfigKeysWithDefault,
  ConfigValueMap,
  RuntimeConfig,
  MaskedConfig,
  EncryptedValue
} from '../../shared/config/types'

/**
 * Configuration store.
 * Manages reading, writing, encrypting, and validating configuration values.
 */
export class ConfigStore {
  private configPathOverride: string | undefined
  private cache: RuntimeConfig | null = null
  private encryptionAvailable: boolean = false

  /**
   * The resolved config file path.
   * Computed lazily so app.setPath() overrides take effect before first access.
   */
  private get configPath(): string {
    return this.configPathOverride ?? join(app.getPath('userData'), 'config.json')
  }

  constructor(configPath?: string) {
    // Store optional override — do not call app.getPath() here so that
    // app.setPath() calls (e.g. for test isolation) can take effect first.
    this.configPathOverride = configPath

    // Check if encryption is available (only after app is ready)
    if (app.isReady()) {
      this.encryptionAvailable = safeStorage.isEncryptionAvailable()
      if (!this.encryptionAvailable) {
        console.warn(
          'Electron safeStorage encryption is not available. Sensitive values cannot be stored securely.'
        )
      }
    }
  }

  /**
   * Initialize the config store.
   * Must be called after app.whenReady().
   */
  initialize(): void {
    this.encryptionAvailable = safeStorage.isEncryptionAvailable()
    if (!this.encryptionAvailable) {
      console.warn(
        'Electron safeStorage encryption is not available. Sensitive values cannot be stored securely.'
      )
    }
    // Load config into cache
    this.load()
  }

  /**
   * Get a configuration value.
   * Returns the stored value, or the default if not set.
   * Keys with a schema default always return a value (never undefined).
   */
  get<K extends ConfigKeysWithDefault>(key: K): ConfigValueMap[K]
  get<K extends ConfigKey>(key: K): ConfigValueMap[K] | undefined
  get<K extends ConfigKey>(key: K): ConfigValueMap[K] | undefined {
    const config = this.load()
    const storedValue = config[key]

    if (storedValue !== undefined) {
      return storedValue
    }

    // Return default if defined
    const schema = CONFIG_SCHEMA[key]
    if ('default' in schema) {
      return schema.default as ConfigValueMap[K]
    }
    return undefined
  }

  /**
   * Set a configuration value.
   * Validates against the schema and encrypts if sensitive.
   */
  set<K extends ConfigKey>(key: K, value: ConfigValueMap[K]): void {
    const schema = CONFIG_SCHEMA[key]

    // Validate with Zod
    const result = schema.type.safeParse(value)
    if (!result.success) {
      throw new Error(`Invalid value for config key "${key}": ${result.error.message}`)
    }

    // Check if this is a sensitive value
    if (schema.sensitive && !this.encryptionAvailable) {
      throw new Error(
        `Cannot store sensitive value for "${key}": encryption is not available on this system.`
      )
    }

    // Load current config
    const config = this.load()

    // Update the value
    config[key] = value

    // Save to disk
    this.save(config)

    // Update cache
    this.cache = config
  }

  /**
   * Reset a configuration value to its default.
   * Removes the stored value.
   */
  reset(key: ConfigKey): void {
    const config = this.load()
    delete config[key]
    this.save(config)
    this.cache = config
  }

  /**
   * Get all configuration values.
   * Sensitive values are masked with '***'.
   */
  getAll(): MaskedConfig {
    const config = this.load()
    const masked: MaskedConfig = {}

    for (const key of Object.keys(CONFIG_SCHEMA) as ConfigKey[]) {
      const schema = CONFIG_SCHEMA[key]
      const storedValue = config[key]
      const defaultValue = 'default' in schema ? schema.default : undefined
      const value = storedValue ?? defaultValue

      if (value === undefined) {
        continue
      }

      if (schema.sensitive) {
        masked[key] = '***'
      } else {
        masked[key] = typeof value === 'string' ? value : String(value)
      }
    }

    return masked
  }

  /**
   * Load configuration from disk.
   * Decrypts sensitive values.
   */
  private load(): RuntimeConfig {
    // Return cached config if available
    if (this.cache !== null) {
      return this.cache
    }

    if (!existsSync(this.configPath)) {
      this.cache = {}
      return this.cache
    }

    try {
      const raw = readFileSync(this.configPath, 'utf-8')
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const stored: Record<string, unknown> = JSON.parse(raw)
      const runtime: Record<string, unknown> = {}

      // Decrypt sensitive values
      for (const [key, value] of Object.entries(stored)) {
        if (this.isEncrypted(value)) {
          runtime[key] = this.decrypt(value)
        } else {
          runtime[key] = value
        }
      }

      this.cache = runtime as RuntimeConfig
      return this.cache
    } catch (error) {
      console.error('Failed to load config:', error)
      this.cache = {}
      return this.cache
    }
  }

  /**
   * Save configuration to disk.
   * Encrypts sensitive values.
   */
  private save(config: RuntimeConfig): void {
    const stored: Record<string, string | EncryptedValue> = {}

    // Encrypt sensitive values
    for (const [key, value] of Object.entries(config)) {
      const schema = CONFIG_SCHEMA[key as ConfigKey]

      if (schema.sensitive) {
        // Sensitive values are always strings (API keys, etc.)
        if (typeof value !== 'string') {
          throw new Error(`Sensitive config value "${key}" must be a string`)
        }
        stored[key] = this.encrypt(value)
      } else {
        // Non-sensitive config values are also strings
        stored[key] = value
      }
    }

    // Ensure directory exists
    const dir = dirname(this.configPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    // Write to disk
    writeFileSync(this.configPath, JSON.stringify(stored, null, 2), 'utf-8')
  }

  /**
   * Encrypt a value using Electron's safeStorage.
   */
  private encrypt(value: string): EncryptedValue {
    if (!this.encryptionAvailable) {
      throw new Error('Encryption is not available')
    }

    const buffer = safeStorage.encryptString(value)
    return {
      __encrypted: true,
      data: buffer.toString('base64')
    }
  }

  /**
   * Decrypt an encrypted value.
   */
  private decrypt(encrypted: EncryptedValue): string {
    if (!this.encryptionAvailable) {
      throw new Error('Encryption is not available')
    }

    const buffer = Buffer.from(encrypted.data, 'base64')
    return safeStorage.decryptString(buffer)
  }

  /**
   * Check if a value is encrypted.
   */
  private isEncrypted(value: unknown): value is EncryptedValue {
    return (
      typeof value === 'object' &&
      value !== null &&
      '__encrypted' in value &&
      (value as EncryptedValue).__encrypted
    )
  }
}
