import { randomUUID } from 'crypto'
import { debugEventBus } from './event-bus'
import type { EmitPayload } from './event-bus'

/**
 * Wraps an async function to emit async-task start/end events.
 * @param taskType - category label (e.g. 'llm:generate', 'cli:exec')
 * @param labelFn - called with the args to produce a human-readable label
 * @param fn - the async function to wrap
 */
export function trackAsync<TArgs extends unknown[], TReturn>(
  taskType: string,
  labelFn: (...args: TArgs) => string,
  fn: (...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    const operationId = randomUUID()
    const label = labelFn(...args)
    const start = Date.now()

    const startPayload: EmitPayload = {
      type: 'async-task',
      taskType,
      label,
      operationId,
      status: 'started'
    }
    debugEventBus.emit(startPayload)

    try {
      const result = await fn(...args)
      const donePayload: EmitPayload = {
        type: 'async-task',
        taskType,
        label,
        operationId,
        status: 'completed',
        elapsedMs: Date.now() - start
      }
      debugEventBus.emit(donePayload)
      return result
    } catch (error) {
      const failPayload: EmitPayload = {
        type: 'async-task',
        taskType,
        label,
        operationId,
        status: 'failed',
        elapsedMs: Date.now() - start,
        error: error instanceof Error ? error.message : String(error)
      }
      debugEventBus.emit(failPayload)
      throw error
    }
  }
}
