import type { LogLevel, LogSource } from '../../shared/types/debug'
import { debugEventBus } from './event-bus'

export interface Logger {
  debug(message: string, data?: unknown): void
  info(message: string, data?: unknown): void
  warn(message: string, data?: unknown): void
  error(message: string, data?: unknown): void
}

/**
 * Creates a structured logger for the given source. warn/error also write
 * to the real console so they surface in devtools and production logs.
 */
export function createLogger(source: LogSource): Logger {
  function log(level: LogLevel, message: string, data?: unknown): void {
    if (data !== undefined) {
      debugEventBus.emit({ type: 'log', level, source, message, data })
    } else {
      debugEventBus.emit({ type: 'log', level, source, message })
    }
  }

  return {
    debug(message, data?) {
      log('debug', message, data)
    },
    info(message, data?) {
      log('info', message, data)
    },
    warn(message, data?) {
      console.warn(`[${source}] ${message}`, ...(data !== undefined ? [data] : []))
      log('warn', message, data)
    },
    error(message, data?) {
      console.error(`[${source}] ${message}`, ...(data !== undefined ? [data] : []))
      log('error', message, data)
    }
  }
}
