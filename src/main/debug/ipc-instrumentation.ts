import { ipcMain } from 'electron'
import { debugEventBus } from './event-bus'
import type { EmitPayload } from './event-bus'

/**
 * Monkey-patches ipcMain.handle to wrap every registered handler with
 * IPC traffic instrumentation. Must be called BEFORE registerIpcHandlers().
 */
export function installIpcInstrumentation(): void {
  const originalHandle = ipcMain.handle.bind(ipcMain)

  ipcMain.handle = function instrumentedHandle(
    channel: string,
    handler: Parameters<typeof ipcMain.handle>[1]
  ): void {
    // Prevent recursion on debug channels
    if (channel.startsWith('debug:')) {
      originalHandle(channel, handler)
      return
    }

    const wrappedHandler: typeof handler = async (event, ...args) => {
      const start = Date.now()
      const requestSize = safeJsonSize(args[0])

      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const result: unknown = await Promise.resolve(handler(event, ...args) as unknown)
        const durationMs = Date.now() - start

        const successPayload: EmitPayload = {
          type: 'ipc-traffic',
          channel,
          durationMs,
          requestSize,
          responseSize: safeJsonSize(result),
          success: true
        }
        debugEventBus.emit(successPayload)

        return result
      } catch (error) {
        const durationMs = Date.now() - start

        const errPayload: EmitPayload = {
          type: 'ipc-traffic',
          channel,
          durationMs,
          requestSize,
          responseSize: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
        debugEventBus.emit(errPayload)

        throw error
      }
    }

    originalHandle(channel, wrappedHandler)
  } as typeof ipcMain.handle
}

function safeJsonSize(value: unknown): number {
  if (value === undefined) return 0
  try {
    return JSON.stringify(value).length
  } catch {
    return 0
  }
}
