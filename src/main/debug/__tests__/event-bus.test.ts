/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron webContents
vi.mock('electron', () => ({
  webContents: {
    fromId: vi.fn()
  }
}))

import { webContents } from 'electron'
import { DebugEventBus } from '../event-bus'
import type { EmitPayload } from '../event-bus'
import type { DebugEvent } from '../../../shared/types/debug'

const logPayload: EmitPayload = {
  type: 'log',
  level: 'info',
  source: 'app',
  message: 'hello'
}

describe('DebugEventBus', () => {
  let mockWc: { id: number; isDestroyed: () => boolean; send: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.clearAllMocks()
    mockWc = { id: 42, isDestroyed: () => false, send: vi.fn() }
    vi.mocked(webContents.fromId).mockImplementation((id) => {
      if (id === mockWc.id) return mockWc as never
      return undefined as never
    })
  })

  it('emits event to subscriber and stores in buffer', () => {
    const bus = new DebugEventBus()
    bus.subscribe(mockWc as never)

    bus.emit(logPayload)

    expect(mockWc.send).toHaveBeenCalledOnce()
    const [channel, event] = mockWc.send.mock.calls[0] as [string, DebugEvent]
    expect(channel).toBe('debug:event')
    expect(event.type).toBe('log')
    expect(event.id).toBeGreaterThan(0)
    expect(event.timestamp).toBeGreaterThan(0)
  })

  it('does not push when no subscribers', () => {
    const bus = new DebugEventBus()

    bus.emit(logPayload)

    expect(mockWc.send).not.toHaveBeenCalled()
  })

  it('returns snapshot on subscribe', () => {
    const bus = new DebugEventBus()
    bus.emit({ type: 'log', level: 'info', source: 'app', message: 'before' })

    const snapshot = bus.subscribe(mockWc as never)
    expect(snapshot).toHaveLength(1)
    expect((snapshot[0] as { message: string }).message).toBe('before')
  })

  it('unsubscribe stops delivery', () => {
    const bus = new DebugEventBus()
    bus.subscribe(mockWc as never)
    bus.unsubscribe(mockWc as never)

    bus.emit(logPayload)

    expect(mockWc.send).not.toHaveBeenCalled()
  })

  it('auto-removes destroyed webContents', () => {
    const bus = new DebugEventBus()
    bus.subscribe(mockWc as never)

    // Make wc appear destroyed
    vi.mocked(webContents.fromId).mockReturnValue({ isDestroyed: () => true } as never)

    bus.emit(logPayload)

    // Second emit — subscriber already cleaned up, no send
    bus.emit(logPayload)
    expect(mockWc.send).not.toHaveBeenCalled()
  })

  it('assigns auto-incrementing ids', () => {
    const bus = new DebugEventBus()
    bus.subscribe(mockWc as never)

    bus.emit({ type: 'log', level: 'info', source: 'app', message: 'a' })
    bus.emit({ type: 'log', level: 'info', source: 'app', message: 'b' })

    const events = bus.getSnapshot()
    expect(events).toHaveLength(2)
    expect(events[0]?.id).toBe(1)
    expect(events[1]?.id).toBe(2)
  })

  it('type filter — only delivers matching events', () => {
    const bus = new DebugEventBus()
    bus.subscribe(mockWc as never, ['async-task'])

    bus.emit({ type: 'log', level: 'info', source: 'app', message: 'skip' })
    expect(mockWc.send).not.toHaveBeenCalled()

    const asyncPayload: EmitPayload = {
      type: 'async-task',
      taskType: 'llm',
      label: 'test',
      operationId: 'x',
      status: 'started'
    }
    bus.emit(asyncPayload)
    expect(mockWc.send).toHaveBeenCalledOnce()
  })
})
