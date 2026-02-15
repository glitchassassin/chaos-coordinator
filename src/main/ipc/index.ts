import { registerProjectHandlers } from './projects'
import { registerTaskHandlers } from './tasks'
import { registerLLMHandlers } from './llm'
import { registerConfigHandlers } from './config'

export function registerIpcHandlers() {
  registerProjectHandlers()
  registerTaskHandlers()
  registerLLMHandlers()
  registerConfigHandlers()
}
