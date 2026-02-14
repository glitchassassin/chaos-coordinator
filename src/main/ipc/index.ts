import { registerProjectHandlers } from './projects'
import { registerTaskHandlers } from './tasks'

export function registerIpcHandlers() {
  registerProjectHandlers()
  registerTaskHandlers()
}
