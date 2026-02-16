import { registerProjectHandlers } from './projects'
import { registerTaskHandlers } from './tasks'
import { registerLLMHandlers } from './llm'
import { registerConfigHandlers } from './config'
import { registerColorHandlers } from './colors'

export function registerIpcHandlers() {
  registerProjectHandlers()
  registerTaskHandlers()
  registerLLMHandlers()
  registerConfigHandlers()
  registerColorHandlers()
}
