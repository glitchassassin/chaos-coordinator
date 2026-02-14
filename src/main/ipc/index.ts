import { registerProjectHandlers } from './projects'
import { registerTaskHandlers } from './tasks'
import { registerLLMHandlers } from './llm'

export function registerIpcHandlers() {
  registerProjectHandlers()
  registerTaskHandlers()
  registerLLMHandlers()
}
