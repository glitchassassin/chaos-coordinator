export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogSource = 'llm' | 'ipc' | 'db' | 'cli' | 'config' | 'app'
export type DebugEventType = 'log' | 'async-task' | 'ipc-traffic'
export type AsyncTaskStatus = 'started' | 'completed' | 'failed'

export interface LogEvent {
  type: 'log'
  id: number
  timestamp: number
  level: LogLevel
  source: LogSource
  message: string
  data?: unknown
}

export interface AsyncTaskEvent {
  type: 'async-task'
  id: number
  timestamp: number
  taskType: string
  label: string
  operationId: string
  status: AsyncTaskStatus
  elapsedMs?: number
  error?: string
}

export interface IpcTrafficEvent {
  type: 'ipc-traffic'
  id: number
  timestamp: number
  channel: string
  durationMs: number
  requestSize: number
  responseSize: number
  success: boolean
  error?: string
}

export type DebugEvent = LogEvent | AsyncTaskEvent | IpcTrafficEvent

export const DEBUG_PUSH_CHANNEL = 'debug:event'
