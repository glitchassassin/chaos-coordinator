/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron to avoid native module errors
vi.mock('electron', () => ({
  webContents: { fromId: vi.fn() }
}))

// Mock the event bus
vi.mock('../event-bus', () => ({
  debugEventBus: {
    emit: vi.fn()
  }
}))

import { debugEventBus } from '../event-bus'
import { createLogger } from '../logger'

describe('createLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('debug emits a debug log event without writing to console', () => {
    const logger = createLogger('app')
    logger.debug('test message', { x: 1 })

    expect(vi.mocked(debugEventBus.emit)).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'log',
        level: 'debug',
        source: 'app',
        message: 'test message'
      })
    )
    expect(console.warn).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })

  it('info emits an info log event without writing to console', () => {
    const logger = createLogger('llm')
    logger.info('info message')

    expect(vi.mocked(debugEventBus.emit)).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'log', level: 'info', source: 'llm' })
    )
    expect(console.warn).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })

  it('warn emits event AND writes to console.warn', () => {
    const logger = createLogger('config')
    logger.warn('something bad')

    expect(vi.mocked(debugEventBus.emit)).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'log', level: 'warn', source: 'config' })
    )
    expect(console.warn).toHaveBeenCalledOnce()
  })

  it('error emits event AND writes to console.error', () => {
    const logger = createLogger('db')
    logger.error('fatal problem', new Error('oops'))

    expect(vi.mocked(debugEventBus.emit)).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'log', level: 'error', source: 'db' })
    )
    expect(console.error).toHaveBeenCalledOnce()
  })

  it('includes data field when provided', () => {
    const logger = createLogger('ipc')
    const data = { key: 'value' }
    logger.info('with data', data)

    expect(vi.mocked(debugEventBus.emit)).toHaveBeenCalledWith(
      expect.objectContaining({ data })
    )
  })
})
