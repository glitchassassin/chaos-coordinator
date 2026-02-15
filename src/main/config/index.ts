import { ConfigStore } from './store'

/**
 * Singleton configuration store instance.
 * Must be initialized after app.whenReady().
 */
export const configStore = new ConfigStore()

export { ConfigStore } from './store'
export type * from '../../shared/config/types'
export { CONFIG_SCHEMA, getSchemaMetadata } from '../../shared/config/schema'
