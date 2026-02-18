import { registerProjectHandlers } from './projects'
import { registerTaskHandlers } from './tasks'
import { registerColumnHistoryHandlers } from './columnHistory'
import { registerLLMHandlers } from './llm'
import { registerConfigHandlers } from './config'
import { registerColorHandlers } from './colors'
import { registerLinksHandlers } from './links'
import { registerIntakeHandlers } from './intake'
import { registerDebugHandlers } from './debug'

export function registerIpcHandlers() {
  registerProjectHandlers()
  registerTaskHandlers()
  registerColumnHistoryHandlers()
  registerLLMHandlers()
  registerConfigHandlers()
  registerColorHandlers()
  registerLinksHandlers()
  registerIntakeHandlers()
  registerDebugHandlers()
}
