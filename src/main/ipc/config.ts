import { ipcMain } from 'electron'
import { configStore, getSchemaMetadata } from '../config'
import type { ConfigKey, ConfigValueMap } from '../../shared/config/types'

/**
 * Register configuration IPC handlers.
 */
export function registerConfigHandlers(): void {
  // Get a single config value
  ipcMain.handle(
    'config:get',
    (_event, request: { key: ConfigKey }): ConfigValueMap[ConfigKey] | undefined => {
      return configStore.get(request.key)
    }
  )

  // Set a config value
  ipcMain.handle(
    'config:set',
    (_event, request: { key: ConfigKey; value: ConfigValueMap[ConfigKey] }): boolean => {
      configStore.set(request.key, request.value)
      return true
    }
  )

  // Get all config values (sensitive values masked)
  ipcMain.handle('config:getAll', () => {
    return configStore.getAll()
  })

  // Get schema metadata for UI generation
  ipcMain.handle('config:getSchema', () => {
    return getSchemaMetadata()
  })

  // Reset a config value to default
  ipcMain.handle('config:reset', (_event, request: { key: ConfigKey }): boolean => {
    configStore.reset(request.key)
    return true
  })
}
