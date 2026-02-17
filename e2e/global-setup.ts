/**
 * Playwright global setup — runs once before all e2e tests.
 *
 * Rebuilds better-sqlite3 for Electron's Node.js version.
 * This is necessary because the Vitest pretest script rebuilds better-sqlite3
 * for the system Node.js version (for unit tests), which is incompatible with
 * Electron's embedded Node.js.
 */

import { execSync } from 'child_process'

export default function globalSetup() {
  console.log('Rebuilding better-sqlite3 for Electron...')
  execSync('./node_modules/.bin/electron-rebuild -f -w better-sqlite3', {
    stdio: 'inherit'
  })
}
