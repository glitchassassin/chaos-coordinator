import { z } from 'zod'

/**
 * The configuration schema.
 * Defines all configuration keys, their types, defaults, and metadata.
 */
export const CONFIG_SCHEMA = {
  'llm.provider': {
    type: z.enum(['openrouter']),
    default: 'openrouter',
    sensitive: false,
    label: 'LLM Provider',
    description: 'The LLM provider to use for AI features',
    group: 'LLM'
  },
  'llm.apiKey': {
    type: z.string().min(1),
    sensitive: true,
    label: 'API Key',
    description: 'Your OpenRouter API key',
    group: 'LLM'
  },
  'llm.model': {
    type: z.string().min(1),
    default: 'anthropic/claude-3.5-sonnet',
    sensitive: false,
    label: 'Model',
    description: 'The default model to use',
    group: 'LLM'
  }
} as const

export type ConfigKey = keyof typeof CONFIG_SCHEMA

/**
 * Config keys that have a default value defined in the schema.
 * get() for these keys always returns a value (never undefined).
 */
export type ConfigKeysWithDefault = {
  [K in ConfigKey]: (typeof CONFIG_SCHEMA)[K] extends { default: unknown } ? K : never
}[ConfigKey]

/**
 * Type map for configuration values.
 * Manually defined to avoid type inference issues.
 */
export interface ConfigValueMap {
  'llm.provider': 'openrouter'
  'llm.apiKey': string
  'llm.model': string
}

/**
 * Schema metadata for a single config key.
 */
export interface ConfigKeyMeta {
  key: ConfigKey
  default?: string | number | boolean
  sensitive: boolean
  label: string
  description: string
  group: string
  zodType: string
  enumOptions?: string[]
}

/**
 * Schema metadata map.
 */
export type ConfigSchemaMetadata = Record<ConfigKey, ConfigKeyMeta>

/**
 * Get the Zod type name for a schema field.
 */
function getZodTypeName(zodType: z.ZodType): string {
  if (zodType instanceof z.ZodEnum) return 'ZodEnum'
  if (zodType instanceof z.ZodString) return 'ZodString'
  if (zodType instanceof z.ZodNumber) return 'ZodNumber'
  if (zodType instanceof z.ZodBoolean) return 'ZodBoolean'
  return 'ZodUnknown'
}

/**
 * Get enum options from a ZodEnum type.
 */
function getEnumOptions(zodType: z.ZodType): string[] | undefined {
  if (zodType instanceof z.ZodEnum) {
    return zodType.options as string[]
  }
  return undefined
}

/**
 * Get schema metadata for UI generation.
 * Excludes the Zod type objects (not serializable).
 */
export function getSchemaMetadata(): ConfigSchemaMetadata {
  const metadata: ConfigSchemaMetadata = {} as ConfigSchemaMetadata

  for (const [key, schema] of Object.entries(CONFIG_SCHEMA)) {
    const enumOptions = getEnumOptions(schema.type)
    const entry: ConfigKeyMeta = {
      key: key as ConfigKey,
      sensitive: schema.sensitive,
      label: schema.label,
      description: schema.description,
      group: schema.group,
      zodType: getZodTypeName(schema.type)
    }

    if ('default' in schema) {
      entry.default = schema.default
    }

    if (enumOptions) {
      entry.enumOptions = enumOptions
    }

    metadata[key as ConfigKey] = entry
  }

  return metadata
}
