import { _electron as electron } from 'playwright'
import type { ElectronApplication } from 'playwright'

export async function launchApp(): Promise<ElectronApplication> {
  const app = await electron.launch({
    args: ['./out/main/index.js']
  })
  return app
}
