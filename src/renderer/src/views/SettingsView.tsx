import { useState, useEffect, useCallback } from 'react'
import type {
  ConfigKey,
  ConfigSchemaMetadata,
  MaskedConfig,
  ConfigKeyMeta
} from '../../../shared/config/types'
import ToastNotification from '../components/Toast'
import { useToast } from '../hooks/useToast'

interface SettingsViewProps {
  firstRun?: boolean
}

export default function SettingsView({ firstRun = false }: SettingsViewProps) {
  const [schema, setSchema] = useState<ConfigSchemaMetadata | null>(null)
  const [values, setValues] = useState<MaskedConfig>({})
  const [errors, setErrors] = useState<Partial<Record<ConfigKey, string>>>({})
  const [validating, setValidating] = useState<Partial<Record<ConfigKey, boolean>>>({})
  const { toast, showToast } = useToast(2000)

  const loadSettings = useCallback(async () => {
    try {
      const [schemaData, currentValues] = await Promise.all([
        window.api.invoke('config:getSchema'),
        window.api.invoke('config:getAll')
      ])
      setSchema(schemaData)
      setValues(currentValues)
    } catch (error: unknown) {
      console.error('Failed to load settings:', error)
    }
  }, [])

  // Load schema and current values on mount
  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  async function handleSave(key: ConfigKey, value: string) {
    setErrors((prev) => ({ ...prev, [key]: undefined }))

    try {
      await window.api.invoke('config:set', { key, value })
      // For sensitive fields, show masked value so the "Configured" badge appears
      const isSensitive = schema !== null && schema[key].sensitive
      setValues((prev) => ({ ...prev, [key]: isSensitive ? '***' : value }))
      showToast('Saved')

      // On first run, if we just saved the API key, reload the app
      if (firstRun && key === 'llm.apiKey') {
        setTimeout(() => {
          window.location.reload()
        }, 1500)
        return
      }

      // Validate LLM connection when model or API key is saved (not during first-run)
      if (key === 'llm.model' || key === 'llm.apiKey') {
        const currentModel = key === 'llm.model' ? value : (values['llm.model'] ?? '')
        if (currentModel) {
          setValidating((prev) => ({ ...prev, 'llm.model': true }))
          try {
            const result = await window.api.invoke('llm:validateModel', {
              model: currentModel
            })
            if (!result.valid) {
              setErrors((prev) => ({
                ...prev,
                'llm.model': result.error ?? 'Model validation failed'
              }))
            } else {
              setErrors((prev) => {
                const next = { ...prev }
                delete next['llm.model']
                return next
              })
            }
          } finally {
            setValidating((prev) => ({ ...prev, 'llm.model': false }))
          }
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save'
      setErrors((prev) => ({ ...prev, [key]: message }))
    }
  }

  async function handleReset(key: ConfigKey) {
    try {
      await window.api.invoke('config:reset', { key })
      await loadSettings()
    } catch (error: unknown) {
      console.error('Failed to reset:', error)
    }
  }

  if (!schema) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-gray-400">Loading settings...</div>
      </div>
    )
  }

  // Group settings by group
  const groups = new Map<string, ConfigKeyMeta[]>()
  for (const [, metadata] of Object.entries(schema) as Array<
    [ConfigKey, ConfigKeyMeta]
  >) {
    const groupItems = groups.get(metadata.group) || []
    groupItems.push(metadata)
    groups.set(metadata.group, groupItems)
  }

  return (
    <div className="relative h-full overflow-auto">
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="mb-6 text-2xl font-bold">Settings</h1>

        {firstRun && (
          <div className="mb-4 rounded-md border border-blue-700 bg-blue-900/30 p-3 text-sm text-blue-200">
            Welcome to Chaos Coordinator! Please configure your LLM API key to get
            started.
          </div>
        )}

        {Array.from(groups.entries()).map(([groupName, items]) => (
          <div key={groupName} className="mb-8">
            <h2 className="mb-4 text-lg font-semibold text-gray-300">{groupName}</h2>
            <div className="space-y-4 rounded-lg bg-gray-900 p-4">
              {items.map((item) => {
                const val = values[item.key]
                return (
                  <SettingField
                    key={item.key}
                    item={item}
                    value={val}
                    error={errors[item.key]}
                    isValidating={validating[item.key] === true}
                    onSave={handleSave}
                    onReset={handleReset}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <ToastNotification toast={toast} />
    </div>
  )
}

interface SettingFieldProps {
  item: ConfigKeyMeta
  value: string | undefined
  error: string | undefined
  isValidating: boolean
  onSave: (key: ConfigKey, value: string) => Promise<void>
  onReset: (key: ConfigKey) => Promise<void>
}

function SettingField({
  item,
  value,
  error,
  isValidating,
  onSave,
  onReset
}: SettingFieldProps) {
  const [inputValue, setInputValue] = useState<string>('')
  const [isDirty, setIsDirty] = useState(false)

  const isSensitiveConfigured = item.sensitive && value === '***'

  useEffect(() => {
    // Initialize input value
    // For sensitive fields that are masked, keep the input empty — the
    // "configured" badge tells the user a value exists.
    if (item.sensitive && value === '***') {
      setInputValue('')
    } else if (value !== undefined) {
      setInputValue(value)
    } else if (item.default !== undefined) {
      setInputValue(item.default.toString())
    }
  }, [value, item.default, item.sensitive])

  function handleChange(newValue: string) {
    setInputValue(newValue)
    setIsDirty(true)
  }

  function handleBlur() {
    if (isDirty && inputValue) {
      onSave(item.key, inputValue).catch((error: unknown) => {
        console.error(error)
      })
      setIsDirty(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && isDirty && inputValue) {
      onSave(item.key, inputValue).catch((error: unknown) => {
        console.error(error)
      })
      setIsDirty(false)
    }
  }

  const displayValue = inputValue
  const placeholder = item.default
    ? item.default.toString()
    : item.sensitive
      ? isSensitiveConfigured
        ? 'Enter new value to replace'
        : 'Not configured'
      : ''
  const isEnum = item.zodType === 'ZodEnum' && item.enumOptions

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label htmlFor={item.key} className="text-sm font-medium text-gray-300">
            {item.label}
          </label>
          {isSensitiveConfigured && (
            <span className="rounded bg-green-900/40 px-1.5 py-0.5 text-xs text-green-400">
              Configured
            </span>
          )}
        </div>
        {item.default !== undefined && (
          <button
            type="button"
            onClick={() => {
              void onReset(item.key)
            }}
            className="text-xs text-gray-500 transition-colors hover:text-gray-300"
          >
            Reset to default
          </button>
        )}
      </div>
      {isEnum && item.enumOptions ? (
        <select
          id={item.key}
          value={displayValue}
          onChange={(e) => {
            handleChange(e.target.value)
            // Save immediately for selects
            void onSave(item.key, e.target.value)
          }}
          className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          {item.enumOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={item.key}
          type={item.sensitive ? 'password' : 'text'}
          value={displayValue}
          placeholder={placeholder}
          onChange={(e) => {
            handleChange(e.target.value)
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
      )}
      <p className="mt-1 text-xs text-gray-500">{item.description}</p>
      {isValidating && <p className="mt-1 text-xs text-blue-400">Validating model...</p>}
      {!isValidating && error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}
