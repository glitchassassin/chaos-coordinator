import { registerProjectHandlers } from './projects'
import { registerTaskHandlers } from './tasks'
import { registerColumnHistoryHandlers } from './columnHistory'
import { registerLLMHandlers } from './llm'
import { registerConfigHandlers } from './config'
import { registerColorHandlers } from './colors'

export function registerIpcHandlers() {
  registerProjectHandlers()
  registerTaskHandlers()
  registerColumnHistoryHandlers()
  registerLLMHandlers()
  registerConfigHandlers()
  registerColorHandlers()
}
