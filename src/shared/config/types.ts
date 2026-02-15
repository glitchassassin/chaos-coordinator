import type {
  ConfigKey,
  ConfigKeysWithDefault,
  ConfigValueMap,
  ConfigSchemaMetadata,
  ConfigKeyMeta
} from './schema'

/**
 * Encrypted value stored on disk.
 */
export interface EncryptedValue {
  __encrypted: true
  data: string // base64-encoded ciphertext
}

/**
 * Stored configuration (on-disk format).
 * Values can be plain or encrypted.
 */
export type StoredConfig = {
  [K in ConfigKey]?: ConfigValueMap[K] | EncryptedValue
}

/**
 * Runtime configuration (decrypted).
 * All values are plain.
 */
export type RuntimeConfig = Partial<ConfigValueMap>

/**
 * Configuration with sensitive values masked.
 * Used for getAll() when values should be hidden.
 */
export type MaskedConfig = Partial<Record<ConfigKey, string>>

export type {
  ConfigKey,
  ConfigKeysWithDefault,
  ConfigValueMap,
  ConfigSchemaMetadata,
  ConfigKeyMeta
}
