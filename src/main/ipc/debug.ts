import { ipcMain } from 'electron'
import type { DebugEventType } from '../../shared/types/debug'
import { debugEventBus } from '../debug'

export function registerDebugHandlers(): void {
  ipcMain.handle('debug:subscribe', (event, request?: { types?: DebugEventType[] }) => {
    const events = debugEventBus.subscribe(event.sender, request?.types)
    return { events }
  })

  ipcMain.handle('debug:unsubscribe', (event) => {
    debugEventBus.unsubscribe(event.sender)
  })
}
